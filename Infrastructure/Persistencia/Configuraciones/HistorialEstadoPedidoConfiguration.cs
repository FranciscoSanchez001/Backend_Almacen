using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class HistorialEstadoPedidoConfiguration : IEntityTypeConfiguration<HistorialEstadoPedido>
    {
        public void Configure(EntityTypeBuilder<HistorialEstadoPedido> builder)
        {
            builder.ToTable("historial_estados_pedido");
            builder.HasKey(h => h.Id);

            builder.Property(h => h.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(h => h.Pedido)
                .WithMany(p => p.HistorialEstados)
                .HasForeignKey(h => h.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(h => h.Usuario)
                .WithMany()
                .HasForeignKey(h => h.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
