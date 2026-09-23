using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class PedidoItemConfiguration : IEntityTypeConfiguration<PedidoItem>
    {
        public void Configure(EntityTypeBuilder<PedidoItem> builder)
        {
            builder.ToTable("pedido_items", t => t.HasCheckConstraint("ck_pedido_items_cantidad", "cantidad > 0"));
            builder.HasKey(i => i.Id);

            builder.Property(i => i.PrecioUsd).HasPrecision(18, 2);
            builder.Property(i => i.PrecioBs).HasPrecision(18, 2);

            builder.HasOne(i => i.Pedido)
                .WithMany(p => p.Items)
                .HasForeignKey(i => i.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(i => i.Producto)
                .WithMany()
                .HasForeignKey(i => i.ProductoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(i => i.Categoria)
                .WithMany()
                .HasForeignKey(i => i.CategoriaId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(i => i.ProductoId);
        }
    }
}
