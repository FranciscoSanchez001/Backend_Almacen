using Backend_Almacen.Data;
using Backend_Almacen.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    // Endpoints de prueba para verificar la conexión con la base de datos.
    [ApiController]
    [Route("[controller]")]
    public class DbTestController(AlmacenDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            if (!await db.Database.CanConnectAsync())
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { conectado = false });
            }

            var configuracion = await db.Configuracion.AsNoTracking().SingleOrDefaultAsync();

            return Ok(new
            {
                conectado = true,
                migracionesAplicadas = await db.Database.GetAppliedMigrationsAsync(),
                migracionesPendientes = await db.Database.GetPendingMigrationsAsync(),
                configuracion,
                categorias = await db.Categorias.CountAsync(),
            });
        }

        [HttpGet("categorias")]
        public async Task<List<Categoria>> GetCategorias() =>
            await db.Categorias.AsNoTracking().OrderBy(c => c.Id).ToListAsync();

        [HttpPost("categorias")]
        public async Task<ActionResult<Categoria>> CrearCategoria([FromBody] string nombre)
        {
            var categoria = new Categoria { Nombre = nombre };
            db.Categorias.Add(categoria);
            await db.SaveChangesAsync();
            return Created($"/DbTest/categorias/{categoria.Id}", categoria);
        }
    }
}
