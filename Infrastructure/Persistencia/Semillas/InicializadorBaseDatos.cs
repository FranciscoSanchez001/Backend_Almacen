using Core.Application.Abstracciones;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Persistencia.Semillas
{
    // Datos que no pueden ir en HasData y se crean al arrancar, solo si faltan:
    // - la fila única de configuración;
    // - el primer superadmin (su contraseña se hashea con bcrypt y sale de la configuración,
    //   sección "SuperadminInicial"). Sin él no habría quién cree al resto del personal.
    public static class InicializadorBaseDatos
    {
        public static async Task InicializarBaseDatosAsync(this IServiceProvider services, IConfiguration configuracion)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IHasherContrasenas>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();

            try
            {
                if (!await db.Configuracion.AnyAsync())
                {
                    db.Configuracion.Add(new Configuracion());
                    await db.SaveChangesAsync();
                    logger.LogInformation("Fila de configuración creada.");
                }

                var seccion = configuracion.GetSection("SuperadminInicial");
                var email = seccion["Email"];
                var password = seccion["Password"];
                if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password)
                    && !await db.Usuarios.AnyAsync(u => u.Rol == RolUsuario.Superadmin))
                {
                    db.Usuarios.Add(new Usuario
                    {
                        Nombre = seccion["Nombre"] ?? "Gerente",
                        Email = email.Trim().ToLowerInvariant(),
                        Rol = RolUsuario.Superadmin,
                        PasswordHash = hasher.Hash(password),
                    });
                    await db.SaveChangesAsync();
                    logger.LogInformation("Superadmin inicial creado: {Email}", email);
                }
            }
            catch (Exception ex)
            {
                // No se tumba el arranque si la base aún no está lista (p. ej. faltan migraciones).
                logger.LogWarning(ex, "No se pudo inicializar la base de datos.");
            }
        }
    }
}
