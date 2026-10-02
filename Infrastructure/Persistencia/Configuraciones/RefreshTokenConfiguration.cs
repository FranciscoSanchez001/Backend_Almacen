using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistencia.Configuraciones
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable("refresh_tokens");
            builder.HasKey(r => r.Id);

            // SHA-256 en hexadecimal: 64 caracteres.
            builder.Property(r => r.TokenHash).IsRequired().HasMaxLength(64).IsFixedLength();
            builder.HasIndex(r => r.TokenHash).IsUnique();

            // Sin FK: solo deja rastro de la cadena de rotación.
            builder.Property(r => r.ReemplazadoPorId).HasColumnName("reemplazado_por");

            // Si se borra el usuario, sus sesiones dejan de tener sentido.
            builder.HasOne(r => r.Usuario)
                .WithMany()
                .HasForeignKey(r => r.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Revocar todas las sesiones activas de un usuario.
            builder.HasIndex(r => new { r.UsuarioId, r.RevocadoEn });
        }
    }
}
