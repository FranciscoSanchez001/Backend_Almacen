using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class CuponConfiguration : IEntityTypeConfiguration<Cupon>
    {
        public void Configure(EntityTypeBuilder<Cupon> builder)
        {
            builder.ToTable("cupones", t =>
            {
                t.HasCheckConstraint("ck_cupones_valor",
                    "valor > 0 AND (tipo <> 'porcentaje' OR valor <= 100)");
                t.HasCheckConstraint("ck_cupones_compra_minima", "compra_minima_usd IS NULL OR compra_minima_usd >= 0");
                t.HasCheckConstraint("ck_cupones_vigencia",
                    "valido_desde IS NULL OR valido_hasta IS NULL OR valido_hasta > valido_desde");
                // Igual que el stock: la base impide pasarse del límite aunque dos pedidos lleguen a la vez.
                t.HasCheckConstraint("ck_cupones_usos",
                    "usos_actuales >= 0 AND (usos_maximos IS NULL OR usos_actuales <= usos_maximos)");
            });
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Codigo).IsRequired().HasMaxLength(30);
            builder.HasIndex(c => c.Codigo).IsUnique();

            builder.Property(c => c.Descripcion).HasMaxLength(200);
            builder.Property(c => c.Valor).HasPrecision(18, 2);
            builder.Property(c => c.CompraMinimaUsd).HasPrecision(18, 2);
            builder.Property(c => c.CreadoPorId).HasColumnName("creado_por");

            builder.HasOne(c => c.CreadoPor)
                .WithMany()
                .HasForeignKey(c => c.CreadoPorId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
