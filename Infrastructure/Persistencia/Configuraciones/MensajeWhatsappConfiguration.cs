using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class MensajeWhatsappConfiguration : IEntityTypeConfiguration<MensajeWhatsapp>
    {
        public void Configure(EntityTypeBuilder<MensajeWhatsapp> builder)
        {
            builder.ToTable("mensajes_whatsapp");
            builder.HasKey(m => m.Id);

            builder.Property(m => m.Telefono).IsRequired().HasMaxLength(20);
            builder.Property(m => m.Plantilla).IsRequired().HasMaxLength(50);
            builder.Property(m => m.Texto).IsRequired().HasMaxLength(1000);
            builder.Property(m => m.Error).HasMaxLength(2000);
            builder.Property(m => m.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(m => m.Pedido)
                .WithMany()
                .HasForeignKey(m => m.PedidoId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
