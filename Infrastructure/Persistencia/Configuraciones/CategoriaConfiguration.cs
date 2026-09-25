using Core.Domain.Entidades;
using Infrastructure.Persistencia.Semillas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class CategoriaConfiguration : IEntityTypeConfiguration<Categoria>
    {
        public void Configure(EntityTypeBuilder<Categoria> builder)
        {
            builder.ToTable("categorias");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Nombre).IsRequired().HasMaxLength(100);
            builder.HasIndex(c => c.Nombre).IsUnique();

            builder.HasData(DatosSemilla.Categorias);
        }
    }
}
