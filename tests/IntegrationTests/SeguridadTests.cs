using System.Net;
using System.Net.Http.Json;
using Core.Application.Dtos;
using IntegrationTests.Infraestructura;

namespace IntegrationTests
{
    // Autenticación JWT y matriz RBAC (Admin = superadmin, Employee = ventas) sobre la API real.
    public class SeguridadTests(ApiFactory api) : ApiTestBase(api)
    {
        [Fact]
        public async Task Productos_SinToken_Devuelve401ConEncabezadoBearer()
        {
            var respuesta = await Anonimo().GetAsync("/productos");

            Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
            Assert.Equal("Bearer", respuesta.Headers.WwwAuthenticate.Single().Scheme);
            Assert.Equal("application/problem+json", respuesta.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Productos_TokenInvalido_Devuelve401()
        {
            var cliente = Anonimo();
            cliente.DefaultRequestHeaders.Authorization = new("Bearer", "esto.no.es-un-jwt");

            var respuesta = await cliente.GetAsync("/productos");

            Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        }

        [Fact]
        public async Task Categorias_ListadoPublico_NoExigeToken()
        {
            var respuesta = await Anonimo().GetAsync("/categorias");

            await EsperarAsync(respuesta, HttpStatusCode.OK);
        }

        [Fact]
        public async Task Ventas_PuedeConsultarProductos()
        {
            var (_, ventas) = await ComoVentasAsync();

            var respuesta = await ventas.GetAsync("/productos");

            await EsperarAsync(respuesta, HttpStatusCode.OK);
        }

        [Fact]
        public async Task Ventas_NoPuedeBorrarProductos_Devuelve403YElProductoSigueActivo()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var creado = await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId));
            var producto = await LeerAsync<Presentation.API.Dtos.ProductoResponse>(creado);
            var (_, ventas) = await ComoVentasAsync();

            var respuesta = await ventas.DeleteAsync($"/productos/{producto.Id}");

            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
            Assert.Equal("application/problem+json", respuesta.Content.Headers.ContentType?.MediaType);
            await EsperarAsync(await admin.GetAsync($"/productos/{producto.Id}"), HttpStatusCode.OK);
        }

        [Fact]
        public async Task Ventas_NoPuedeCrearCategorias_Devuelve403()
        {
            var (_, ventas) = await ComoVentasAsync();

            var respuesta = await ventas.PostAsJsonAsync("/categorias", new CategoriaRequest($"Prohibida {Unico()}"));

            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }

        [Fact]
        public async Task Ventas_NoPuedeGestionarUsuarios_Devuelve403()
        {
            var (_, ventas) = await ComoVentasAsync();

            var respuesta = await ventas.GetAsync("/usuarios");

            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }

        // OnTokenValidated consulta la base en cada petición: desactivar al usuario corta el acceso
        // aunque su JWT todavía no haya vencido.
        [Fact]
        public async Task UsuarioDesactivado_PierdeElAccesoConSuTokenVigente()
        {
            var (ventasId, ventas) = await ComoVentasAsync();
            await EsperarAsync(await ventas.GetAsync("/productos"), HttpStatusCode.OK);

            var admin = await ComoAdminAsync();
            var desactivar = await admin.PostAsync($"/usuarios/{ventasId}/desactivar", null);
            Assert.True(desactivar.IsSuccessStatusCode, $"Desactivar devolvió {(int)desactivar.StatusCode}.");

            var respuesta = await ventas.GetAsync("/productos");

            Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        }
    }
}
