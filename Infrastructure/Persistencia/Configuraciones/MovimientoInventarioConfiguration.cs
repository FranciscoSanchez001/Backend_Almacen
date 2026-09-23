using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class MovimientoInventarioConfiguration : IEntityTypeConfiguration<MovimientoInventario>
    {
        public void Configure(EntityTypeBuilder<MovimientoInventario> builder)
        {
            builder.ToTable("movimientos_inventario");
            builder.HasKey(m => m.Id);

            builder.Property(m => m.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(m => m.Producto)
                .WithMany()
                .HasForeignKey(m => m.ProductoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(m => m.Pedido)
                .WithMany()
                .HasForeignKey(m => m.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(m => m.Usuario)
                .WithMany()
                .HasForeignKey(m => m.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(m => new { m.ProductoId, m.CreadoEn });
        }
    }
}
