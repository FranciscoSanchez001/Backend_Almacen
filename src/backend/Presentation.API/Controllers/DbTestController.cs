using Core.Application.Abstracciones;
using Presentation.API.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Endpoint de prueba para verificar la conexión con la base de datos. Solo Admin: expone la
    // configuración del negocio y el estado de las migraciones.
    [ApiController]
    [Route("[controller]")]
    [Authorize(Roles = Roles.Admin)]
    public class DbTestController(
        IDiagnosticoBaseDatos diagnostico,
        IConfiguracionRepository configuracion,
        ICategoriaRepository categorias,
        IProductoRepository productos) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get(CancellationToken ct)
        {
            if (!await diagnostico.PuedeConectarAsync(ct))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { conectado = false });
            }

            return Ok(new
            {
                conectado = true,
                migracionesAplicadas = await diagnostico.MigracionesAplicadasAsync(ct),
                migracionesPendientes = await diagnostico.MigracionesPendientesAsync(ct),
                configuracion = await configuracion.ObtenerAsync(ct),
                categorias = (await categorias.ListarAsync(ct)).Count,
                productos = (await productos.ListarAsync(new FiltroProductos(), 1, 1, ct)).Total,
            });
        }
    }
}
