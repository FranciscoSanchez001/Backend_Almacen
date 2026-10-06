using Infrastructure.Persistencia;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace IntegrationTests.Infraestructura
{
    // La API completa (Program.cs, middleware, JWT, filtros, EF Core) servida en memoria contra un
    // PostgreSQL 16 en Docker, el mismo motor de docker-compose.yml. Hace falta un PostgreSQL real:
    // el esquema usa enums nativos y el inventario, UPDATE condicionales y SELECT ... FOR UPDATE.
    //
    // Un solo contenedor para todas las pruebas (colección "Api"): cada prueba usa datos propios
    // (SKU, correos y categorías únicos), así que no hace falta limpiar entre una y otra.
    public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
    {
        public const string EmailAdmin = "admin@pruebas.local";
        public const string PasswordAdmin = "Admin1234!";

        private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
            .WithDatabase("almacen_pruebas")
            .Build();

        public async Task InitializeAsync()
        {
            await _postgres.StartAsync();

            // Las migraciones van antes de arrancar la API: al iniciar, Program.cs crea la fila de
            // configuración y el superadmin inicial, y para eso las tablas ya tienen que existir.
            var opciones = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_postgres.GetConnectionString(), ApplicationDbContext.ConfigurarNpgsql)
                .UseSnakeCaseNamingConvention()
                .Options;
            await using var db = new ApplicationDbContext(opciones);
            await db.Database.MigrateAsync();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // UseSetting y no ConfigureAppConfiguration: Program.cs lee la sección Jwt antes de
            // builder.Build(), y solo así la configuración de la prueba ya está disponible.
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Almacen", _postgres.GetConnectionString());
            builder.UseSetting("Jwt:Key", "clave-de-pruebas-de-integracion-0123456789abcdef");
            builder.UseSetting("SuperadminInicial:Nombre", "Admin de pruebas");
            builder.UseSetting("SuperadminInicial:Email", EmailAdmin);
            builder.UseSetting("SuperadminInicial:Password", PasswordAdmin);

            // Sin el job de expiración ni el worker de WhatsApp: no influyen en estas pruebas y
            // así no tocan la base en segundo plano.
            builder.ConfigureTestServices(services => services.RemoveAll<IHostedService>());
        }

        // Para comprobar en la base lo que dejó una petición (movimientos, auditoría...).
        public async Task<T> ConsultarAsync<T>(Func<ApplicationDbContext, Task<T>> consulta)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await consulta(db);
        }

        async Task IAsyncLifetime.DisposeAsync()
        {
            await base.DisposeAsync();
            await _postgres.DisposeAsync();
        }
    }

    [CollectionDefinition(Nombre)]
    public class ColeccionApi : ICollectionFixture<ApiFactory>
    {
        public const string Nombre = "Api";
    }
}
