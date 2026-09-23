using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend_Almacen.Infrastructure.Persistencia.Configuraciones
{
    public class UsuarioConfiguration : IEntityTypeConfiguration<Usuario>
    {
        public void Configure(EntityTypeBuilder<Usuario> builder)
        {
            builder.ToTable("usuarios", t => t.HasCheckConstraint("ck_usuarios_credenciales",
                "(rol = 'cliente' AND google_id IS NOT NULL) OR (rol <> 'cliente' AND password_hash IS NOT NULL)"));
            builder.HasKey(u => u.Id);

            builder.Property(u => u.Nombre).IsRequired().HasMaxLength(150);
            builder.Property(u => u.Email).IsRequired().HasMaxLength(254);
            builder.Property(u => u.Telefono).HasMaxLength(20);
            builder.Property(u => u.GoogleId).HasMaxLength(255);
            builder.Property(u => u.PasswordHash).HasMaxLength(100);
            builder.Property(u => u.CreadoEn).HasDefaultValueSql("now()");

            builder.HasIndex(u => u.Email).IsUnique();
            builder.HasIndex(u => u.GoogleId).IsUnique();
        }
    }
}
