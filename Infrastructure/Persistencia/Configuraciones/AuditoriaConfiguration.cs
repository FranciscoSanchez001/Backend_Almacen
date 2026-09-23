using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class AuditoriaConfiguration : IEntityTypeConfiguration<Auditoria>
    {
        public void Configure(EntityTypeBuilder<Auditoria> builder)
        {
            builder.ToTable("auditoria");
            builder.HasKey(a => a.Id);

            builder.Property(a => a.Entidad).IsRequired().HasMaxLength(50);
            builder.Property(a => a.DatosAntes).HasColumnType("jsonb");
            builder.Property(a => a.DatosDespues).HasColumnType("jsonb");
            builder.Property(a => a.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(a => a.Usuario)
                .WithMany()
                .HasForeignKey(a => a.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(a => a.CreadoEn);
            builder.HasIndex(a => new { a.Entidad, a.EntidadId });
        }
    }
}
