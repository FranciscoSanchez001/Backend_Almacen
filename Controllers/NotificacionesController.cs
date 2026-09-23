using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    [ApiController]
    [Route("notificaciones")]
    [Authorize(Roles = Roles.Personal)]
    public class NotificacionesController(AlmacenDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<NotificacionResponse>> Listar(
            [FromQuery] bool soloNoLeidas = true,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50)
        {
            var query = db.Notificaciones.AsNoTracking();
            if (soloNoLeidas)
            {
                query = query.Where(n => !n.Leida);
            }

            return await Pagina<NotificacionResponse>.CrearAsync(
                query.OrderByDescending(n => n.CreadoEn).ThenByDescending(n => n.Id)
                    .Select(n => new NotificacionResponse(n.Id, n.Tipo, n.ProductoId,
                        n.Producto == null ? null : n.Producto.Nombre, n.PedidoId, n.Leida, n.CreadoEn)),
                pagina, tamano);
        }

        [HttpPost("{id:int}/leer")]
        public async Task<IActionResult> MarcarLeida(int id)
        {
            var filas = await db.Notificaciones
                .Where(n => n.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true));
            return filas == 0 ? NotFound() : NoContent();
        }

        [HttpPost("leer-todas")]
        public async Task<IActionResult> MarcarTodasLeidas()
        {
            await db.Notificaciones
                .Where(n => !n.Leida)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true));
            return NoContent();
        }
    }
}
