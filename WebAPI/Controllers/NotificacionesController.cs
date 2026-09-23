using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.WebAPI.Auth;
using Backend_Almacen.WebAPI.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.WebAPI.Controllers
{
    [ApiController]
    [Route("notificaciones")]
    [Authorize(Roles = Roles.Personal)]
    public class NotificacionesController(INotificacionRepository notificaciones) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<NotificacionResponse>> Listar(
            [FromQuery] bool soloNoLeidas = true,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default) =>
            (await notificaciones.ListarAsync(soloNoLeidas, pagina, tamano, ct)).Convertir(NotificacionResponse.De);

        [HttpPost("{id:guid}/leer")]
        public async Task<IActionResult> MarcarLeida(Guid id, CancellationToken ct) =>
            await notificaciones.MarcarLeidaAsync(id, ct) ? NoContent() : NotFound();

        [HttpPost("leer-todas")]
        public async Task<IActionResult> MarcarTodasLeidas(CancellationToken ct)
        {
            await notificaciones.MarcarTodasLeidasAsync(ct);
            return NoContent();
        }
    }
}
