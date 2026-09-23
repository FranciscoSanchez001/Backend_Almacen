using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class PedidoConfiguration : IEntityTypeConfiguration<Pedido>
    {
        public void Configure(EntityTypeBuilder<Pedido> builder)
        {
            builder.ToTable("pedidos", t => t.HasCheckConstraint("ck_pedidos_totales",
                "total_usd >= 0 AND total_bs >= 0 AND tasa_cambio > 0"));
            builder.HasKey(p => p.Id);

            // Correlativo legible, generado por PostgreSQL.
            builder.Property(p => p.Numero).UseIdentityAlwaysColumn();
            builder.HasIndex(p => p.Numero).IsUnique();

            builder.Property(p => p.TasaCambio).HasPrecision(18, 4);
            builder.Property(p => p.TotalUsd).HasPrecision(18, 2);
            builder.Property(p => p.TotalBs).HasPrecision(18, 2);
            builder.Property(p => p.ReferenciaPago).HasMaxLength(100);
            builder.Property(p => p.CapturaUrl).HasMaxLength(500);
            builder.Property(p => p.DireccionTexto).IsRequired().HasMaxLength(500);
            builder.Property(p => p.TelefonoContacto).IsRequired().HasMaxLength(20);
            builder.Property(p => p.MotivoRechazo).HasMaxLength(300);
            builder.Property(p => p.RevisadoPorId).HasColumnName("revisado_por");
            builder.Property(p => p.CreadoEn).HasDefaultValueSql("now()");

            builder.HasOne(p => p.Cliente)
                .WithMany()
                .HasForeignKey(p => p.ClienteId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.RevisadoPor)
                .WithMany()
                .HasForeignKey(p => p.RevisadoPorId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.Repartidor)
                .WithMany()
                .HasForeignKey(p => p.RepartidorId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.Zona)
                .WithMany()
                .HasForeignKey(p => p.ZonaId)
                .OnDelete(DeleteBehavior.Restrict);

            // Índices para la bandeja, los KPIs, el Excel y el job de expiración.
            builder.HasIndex(p => new { p.Estado, p.CreadoEn });
            builder.HasIndex(p => new { p.Estado, p.ExpiraEn });
            builder.HasIndex(p => p.ZonaId);
        }
    }
}
