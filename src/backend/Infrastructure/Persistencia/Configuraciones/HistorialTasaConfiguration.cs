using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class HistorialTasaConfiguration : IEntityTypeConfiguration<HistorialTasa>
    {
        public void Configure(EntityTypeBuilder<HistorialTasa> builder)
        {
            builder.ToTable("historial_tasas", t => t.HasCheckConstraint("ck_historial_tasas_tasa", "tasa > 0"));
            builder.HasKey(h => h.Id);

            builder.Property(h => h.Tasa).HasPrecision(18, 4);

            builder.HasOne(h => h.Usuario)
                .WithMany()
                .HasForeignKey(h => h.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
