using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class NotificacionConfiguration : IEntityTypeConfiguration<Notificacion>
    {
        public void Configure(EntityTypeBuilder<Notificacion> builder)
        {
            builder.ToTable("notificaciones", t => t.HasCheckConstraint("ck_notificaciones_referencia",
                "producto_id IS NOT NULL OR pedido_id IS NOT NULL"));
            builder.HasKey(n => n.Id);


            builder.HasOne(n => n.Producto)
                .WithMany()
                .HasForeignKey(n => n.ProductoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(n => n.Pedido)
                .WithMany()
                .HasForeignKey(n => n.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(n => new { n.Leida, n.CreatedAt })
                .HasDatabaseName("ix_notificaciones_leida_creado_en");
        }
    }
}
