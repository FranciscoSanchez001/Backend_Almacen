using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Core.Application.Dtos;

namespace IntegrationTests.Infraestructura
{
    // Base de las clases de prueba: clientes HTTP autenticados por rol y datos únicos por prueba.
    [Collection(ColeccionApi.Nombre)]
    public abstract class ApiTestBase(ApiFactory api)
    {
        // Igual que la API: camelCase y enums en snake_case ("superadmin", "en_camino").
        protected static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        };

        protected ApiFactory Api { get; } = api;

        protected HttpClient Anonimo() => Api.CreateClient();

        protected async Task<HttpClient> ComoAdminAsync() =>
            Autenticado((await LoginAsync(ApiFactory.EmailAdmin, ApiFactory.PasswordAdmin)).Token);

        // Crea un usuario de ventas (Employee) con el admin y devuelve su id y un cliente con su token.
        protected async Task<(Guid Id, HttpClient Cliente)> ComoVentasAsync()
        {
            var admin = await ComoAdminAsync();
            var email = $"ventas-{Unico().ToLowerInvariant()}@pruebas.local";
            const string password = "Ventas1234!";
            var respuesta = await admin.PostAsJsonAsync("/usuarios",
                new { nombre = "Vendedor de pruebas", email, telefono = (string?)null, rol = "ventas", password });
            await EsperarAsync(respuesta, HttpStatusCode.Created);
            var id = (await LeerAsync<JsonElement>(respuesta)).GetProperty("id").GetGuid();

            return (id, Autenticado((await LoginAsync(email, password)).Token));
        }

        protected async Task<AuthResponseDto> LoginAsync(string email, string password)
        {
            var respuesta = await Anonimo().PostAsJsonAsync("/auth/login", new LoginDto(email, password));
            await EsperarAsync(respuesta, HttpStatusCode.OK);
            return await LeerAsync<AuthResponseDto>(respuesta);
        }

        protected async Task<Guid> CrearCategoriaAsync(HttpClient admin)
        {
            var respuesta = await admin.PostAsJsonAsync("/categorias", new CategoriaRequest($"Categoría {Unico()}"));
            await EsperarAsync(respuesta, HttpStatusCode.Created);
            return (await LeerAsync<JsonElement>(respuesta)).GetProperty("id").GetGuid();
        }

        protected static CrearProductoRequest NuevoProducto(Guid categoriaId, string? sku = null,
            decimal precio = 2.5m, int stockInicial = 20) =>
            new(sku ?? $"PRU-{Unico()}", "Harina de maíz", "Paquete de 1 kg", precio, 1.75m, null,
                categoriaId, stockInicial, 5, 100, "P1-E1", "paquete");

        protected static async Task<T> LeerAsync<T>(HttpResponseMessage respuesta) =>
            (await respuesta.Content.ReadFromJsonAsync<T>(Json))!;

        // Si el código no es el esperado, el mensaje incluye el cuerpo (el Problem Details).
        protected static async Task EsperarAsync(HttpResponseMessage respuesta, HttpStatusCode esperado)
        {
            if (respuesta.StatusCode != esperado)
            {
                var cuerpo = await respuesta.Content.ReadAsStringAsync();
                Assert.Fail($"Se esperaba {(int)esperado} {esperado} y llegó {(int)respuesta.StatusCode} " +
                    $"{respuesta.StatusCode}: {cuerpo}");
            }
        }

        protected static string Unico() => Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

        private HttpClient Autenticado(string token)
        {
            var cliente = Api.CreateClient();
            cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return cliente;
        }
    }
}
