using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Infrastructure.Persistencia.Semillas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class ZonaConfiguration : IEntityTypeConfiguration<Zona>
    {
        public void Configure(EntityTypeBuilder<Zona> builder)
        {
            builder.ToTable("zonas");
            builder.HasKey(z => z.Id);

            builder.Property(z => z.Nombre).IsRequired().HasMaxLength(100);
            builder.HasIndex(z => z.Nombre).IsUnique();

            builder.HasData(DatosSemilla.Zonas);
        }
    }
}
