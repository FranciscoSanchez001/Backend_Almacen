using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class ConfiguracionConfiguration : IEntityTypeConfiguration<Configuracion>
    {
        public void Configure(EntityTypeBuilder<Configuracion> builder)
        {
            builder.ToTable("configuracion", t =>
            {
                t.HasCheckConstraint("ck_configuracion_una_fila", $"id = '{Configuracion.IdUnico}'");
                t.HasCheckConstraint("ck_configuracion_horas_expiracion", "horas_expiracion > 0");
            });
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).ValueGeneratedNever();

            builder.Property(c => c.TasaBsUsd).HasPrecision(18, 4);
            builder.Property(c => c.NumeroSoporte).HasMaxLength(20);
            builder.Property(c => c.HorasExpiracion).HasDefaultValue(5);
            builder.Property(c => c.DatosTransferencia).HasMaxLength(1000);
            builder.Property(c => c.DatosPagoMovil).HasMaxLength(1000);
            builder.Property(c => c.WalletBinance).HasMaxLength(200);
            builder.Property(c => c.NumerosPrueba).HasDefaultValueSql("'{}'");

            // La fila única la crea InicializadorBaseDatos al arrancar (HasData no compara bien
            // listas y dejaría el modelo con cambios pendientes).
        }
    }
}
