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
    //   sección "SuperadminInicial"). Sin él no habría quién cree al resto del personal;
    // - las imágenes de demostración de los productos sembrados que aún no tienen imagen
    //   (las que alguien haya puesto a mano no se tocan).
    public static class InicializadorBaseDatos
    {
        public static async Task InicializarBaseDatosAsync(this IServiceProvider services, IConfiguration configuracion)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IHasherContrasenas>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();

            // En producción (Railway) no existe el contenedor de migraciones de docker-compose: con
            // BaseDatos:AplicarMigraciones=true la API aplica las pendientes al arrancar. Va fuera del
            // try: si una migración falla la API no arranca, el healthcheck falla y el hosting
            // mantiene la versión anterior en lugar de publicar una con el esquema a medias.
            if (configuracion.GetValue<bool>("BaseDatos:AplicarMigraciones"))
            {
                var pendientes = (await db.Database.GetPendingMigrationsAsync()).ToList();
                if (pendientes.Count > 0)
                {
                    logger.LogInformation("Aplicando {Cantidad} migraciones: {Migraciones}",
                        pendientes.Count, string.Join(", ", pendientes));
                    await db.Database.MigrateAsync();
                }
            }

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

                var skus = ImagenesProductos.PorSku.Keys.ToList();
                var sinImagen = await db.Productos
                    .Where(p => skus.Contains(p.CodigoSku) && (p.ImagenUrl == null || p.ImagenUrl == ""))
                    .ToListAsync();
                if (sinImagen.Count > 0)
                {
                    foreach (var p in sinImagen)
                    {
                        p.ImagenUrl = ImagenesProductos.Para(p.CodigoSku);
                    }
                    await db.SaveChangesAsync();
                    logger.LogInformation("Imágenes de demostración asignadas a {Cantidad} productos.", sinImagen.Count);
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
