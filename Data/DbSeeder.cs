using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Data
{
    public static class DbSeeder
    {
        // Crea el primer superadmin a partir de la sección "SuperadminInicial" de la configuración,
        // solo si todavía no existe ninguno. Sin él no habría quién cree al resto del personal.
        public static async Task SembrarSuperadminAsync(WebApplication app)
        {
            var seccion = app.Configuration.GetSection("SuperadminInicial");
            var email = seccion["Email"];
            var password = seccion["Password"];
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                return;
            }

            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AlmacenDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<AlmacenDbContext>>();

            try
            {
                if (await db.Usuarios.AnyAsync(u => u.Rol == RolUsuario.Superadmin))
                {
                    return;
                }

                db.Usuarios.Add(new Usuario
                {
                    Nombre = seccion["Nombre"] ?? "Gerente",
                    Email = email.Trim().ToLowerInvariant(),
                    Rol = RolUsuario.Superadmin,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                });
                await db.SaveChangesAsync();
                logger.LogInformation("Superadmin inicial creado: {Email}", email);
            }
            catch (Exception ex)
            {
                // No se tumba el arranque si la base aún no está lista (p. ej. faltan migraciones).
                logger.LogWarning(ex, "No se pudo crear el superadmin inicial.");
            }
        }
    }
}
