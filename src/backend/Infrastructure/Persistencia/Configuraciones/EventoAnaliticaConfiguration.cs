using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class EventoAnaliticaConfiguration : IEntityTypeConfiguration<EventoAnalitica>
    {
        public void Configure(EntityTypeBuilder<EventoAnalitica> builder)
        {
            builder.ToTable("eventos_analitica");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.SesionId).IsRequired().HasMaxLength(64);
            builder.Property(e => e.Texto).HasMaxLength(200);
            builder.Property(e => e.Ruta).HasMaxLength(200);
            builder.Property(e => e.Valor).HasPrecision(18, 2);

            builder.HasOne(e => e.Cliente)
                .WithMany()
                .HasForeignKey(e => e.ClienteId)
                .OnDelete(DeleteBehavior.Restrict);

            // El panel siempre filtra por período, casi siempre también por tipo; la limpieza, por fecha.
            builder.HasIndex(e => new { e.Tipo, e.CreatedAt })
                .HasDatabaseName("ix_eventos_analitica_tipo_creado_en");
            builder.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("ix_eventos_analitica_creado_en");
        }
    }
}
