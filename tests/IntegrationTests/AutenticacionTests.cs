using System.Net;
using System.Net.Http.Json;
using Core.Application.Dtos;
using Core.Domain.Enums;
using IntegrationTests.Infraestructura;

namespace IntegrationTests
{
    // Login del personal y rotación de refresh tokens, de punta a punta: controlador, BCrypt,
    // repositorios y PostgreSQL.
    public class AutenticacionTests(ApiFactory api) : ApiTestBase(api)
    {
        [Fact]
        public async Task Login_SuperadminInicial_DevuelveJwtYRefreshToken()
        {
            var sesion = await LoginAsync(ApiFactory.EmailAdmin, ApiFactory.PasswordAdmin);

            Assert.False(string.IsNullOrWhiteSpace(sesion.Token));
            Assert.False(string.IsNullOrWhiteSpace(sesion.RefreshToken));
            Assert.Equal(RolUsuario.Superadmin, sesion.Rol);
            Assert.Equal(ApiFactory.EmailAdmin, sesion.Email);
            Assert.True(sesion.ExpiraEn > DateTime.UtcNow);
        }

        [Fact]
        public async Task Login_ContrasenaIncorrecta_Devuelve401ConProblemDetails()
        {
            var respuesta = await Anonimo().PostAsJsonAsync("/auth/login",
                new LoginDto(ApiFactory.EmailAdmin, "NoEsLaClave1!"));

            Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
            Assert.Equal("application/problem+json", respuesta.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Yo_ConToken_DevuelveElUsuarioDeLaSesion()
        {
            var admin = await ComoAdminAsync();

            var respuesta = await admin.GetAsync("/auth/yo");

            await EsperarAsync(respuesta, HttpStatusCode.OK);
            var usuario = await LeerAsync<UsuarioSesion>(respuesta);
            Assert.Equal(ApiFactory.EmailAdmin, usuario.Email);
            Assert.Equal(RolUsuario.Superadmin, usuario.Rol);
        }

        [Fact]
        public async Task Refresh_RotaElTokenYRechazaReutilizarElAnterior()
        {
            var sesion = await LoginAsync(ApiFactory.EmailAdmin, ApiFactory.PasswordAdmin);
            var cliente = Anonimo();

            var primera = await cliente.PostAsJsonAsync("/auth/refresh", new RefreshTokenDto(sesion.RefreshToken));
            await EsperarAsync(primera, HttpStatusCode.OK);
            var nueva = await LeerAsync<AuthResponseDto>(primera);
            Assert.NotEqual(sesion.RefreshToken, nueva.RefreshToken);

            var reutilizado = await cliente.PostAsJsonAsync("/auth/refresh", new RefreshTokenDto(sesion.RefreshToken));
            Assert.Equal(HttpStatusCode.Unauthorized, reutilizado.StatusCode);

            // La reutilización cierra todas las sesiones del usuario, incluida la recién rotada.
            var rotado = await cliente.PostAsJsonAsync("/auth/refresh", new RefreshTokenDto(nueva.RefreshToken));
            Assert.Equal(HttpStatusCode.Unauthorized, rotado.StatusCode);
        }
    }
}
