using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class NotificacionConfiguration : IEntityTypeConfiguration<Notificacion>
    {
        public void Configure(EntityTypeBuilder<Notificacion> builder)
        {
            builder.ToTable("notificaciones", t => t.HasCheckConstraint("ck_notificaciones_referencia",
                "producto_id IS NOT NULL OR pedido_id IS NOT NULL"));
            builder.HasKey(n => n.Id);

            builder.Property(n => n.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(n => n.Producto)
                .WithMany()
                .HasForeignKey(n => n.ProductoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(n => n.Pedido)
                .WithMany()
                .HasForeignKey(n => n.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(n => new { n.Leida, n.CreadoEn });
        }
    }
}
