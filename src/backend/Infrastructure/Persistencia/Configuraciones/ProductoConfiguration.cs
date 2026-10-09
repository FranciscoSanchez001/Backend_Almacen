using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class ProductoConfiguration : IEntityTypeConfiguration<Producto>
    {
        public void Configure(EntityTypeBuilder<Producto> builder)
        {
            builder.ToTable("productos", t =>
            {
                t.HasCheckConstraint("ck_productos_precio_usd", "precio_usd >= 0");
                t.HasCheckConstraint("ck_productos_costo_usd", "costo_usd >= 0");
                t.HasCheckConstraint("ck_productos_stock_disponible", "stock_disponible >= 0");
                t.HasCheckConstraint("ck_productos_stock_reservado", "stock_reservado >= 0");
                t.HasCheckConstraint("ck_productos_stock_minimo", "stock_minimo >= 0");
                t.HasCheckConstraint("ck_productos_stock_maximo", "stock_maximo > stock_minimo");
            });
            builder.HasKey(p => p.Id);

            builder.Property(p => p.CodigoSku).IsRequired().HasMaxLength(30);
            builder.HasIndex(p => p.CodigoSku).IsUnique();

            builder.Property(p => p.Nombre).IsRequired().HasMaxLength(200);
            builder.Property(p => p.Descripcion).HasMaxLength(1000);
            builder.Property(p => p.ImagenUrl).HasMaxLength(500);
            builder.Property(p => p.PrecioUsd).HasPrecision(18, 2);
            builder.Property(p => p.CostoUsd).HasPrecision(18, 2);
            builder.Property(p => p.CreadoPorId).HasColumnName("creado_por");

            // Valores por defecto también en la base. El centinela -1 hace que EF mande siempre el
            // valor de la entidad (incluido un 0 explícito) y deje el default solo para INSERTs manuales.
            builder.Property(p => p.StockMinimo)
                .HasDefaultValue(Producto.ValoresPorDefecto.StockMinimo).HasSentinel(-1);
            builder.Property(p => p.StockMaximo)
                .HasDefaultValue(Producto.ValoresPorDefecto.StockMaximo).HasSentinel(-1);
            builder.Property(p => p.Ubicacion).HasMaxLength(50);
            builder.Property(p => p.UnidadMedida).IsRequired().HasMaxLength(20)
                .HasDefaultValue(Producto.ValoresPorDefecto.UnidadMedida);

            builder.HasOne(p => p.Categoria)
                .WithMany(c => c.Productos)
                .HasForeignKey(p => p.CategoriaId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.CreadoPor)
                .WithMany()
                .HasForeignKey(p => p.CreadoPorId)
                .OnDelete(DeleteBehavior.Restrict);

            // Catálogo público: activo = true AND stock_disponible > 0.
            builder.HasIndex(p => new { p.Activo, p.StockDisponible });
        }
    }
}
