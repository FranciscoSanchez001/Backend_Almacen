using Backend_Almacen.Application.Abstracciones;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.WebAPI.Controllers
{
    // Endpoint de prueba para verificar la conexión con la base de datos.
    [ApiController]
    [Route("[controller]")]
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
