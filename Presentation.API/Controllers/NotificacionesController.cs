using Core.Application.Abstracciones;
using Core.Application.Comun;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
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
