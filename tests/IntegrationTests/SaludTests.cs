using System.Net;
using IntegrationTests.Infraestructura;

namespace IntegrationTests
{
    // GET /health: lo consulta el healthcheck de docker-compose, así que debe responder sin token.
    public class SaludTests(ApiFactory api) : ApiTestBase(api)
    {
        [Fact]
        public async Task Health_SinToken_Devuelve200Healthy()
        {
            var respuesta = await Anonimo().GetAsync("/health");

            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            Assert.Equal("Healthy", await respuesta.Content.ReadAsStringAsync());
        }
    }
}
