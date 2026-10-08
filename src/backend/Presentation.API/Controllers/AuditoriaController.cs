using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Modelos;
using Core.Application.Servicios;
using Presentation.API.Auth;
using Presentation.API.Comun;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Auditoría (solo superadmin). Fechas en UTC: desde inclusive, hasta exclusive.
    [ApiController]
    [Route("auditoria")]
    [Authorize(Roles = Roles.Superadmin)]
    public class AuditoriaController(IAuditoriaRepository auditoria) : ControllerBase
    {
        // Quién cambió qué y el valor antes y después: productos y stock, categorías, zonas,
        // usuarios, configuración y descargas de reportes. productoId es un atajo de
        // entidad=producto&entidadId=...
        [HttpGet]
        public async Task<ActionResult<Pagina<AuditoriaResponse>>> Listar(
            [FromQuery] Guid? usuarioId,
            [FromQuery] Guid? productoId,
            [FromQuery] string? entidad,
            [FromQuery] Guid? entidadId,
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default)
        {
            if (productoId is not null)
            {
                if (entidad is not null && !entidad.Equals(Entidades.Producto, StringComparison.OrdinalIgnoreCase))
                {
                    ModelState.AddModelError(nameof(productoId), "productoId solo se puede combinar con entidad=producto.");
                    return ValidationProblem(ModelState);
                }
                entidad = Entidades.Producto;
                entidadId = productoId;
            }
            if (RangoInvalido(desde, hasta) is { } invalido)
            {
                return invalido;
            }

            var filtro = new FiltroAuditoria(usuarioId, entidad, entidadId, Fechas.AUtc(desde), Fechas.AUtc(hasta));
            return (await auditoria.ListarAsync(filtro, pagina, tamano, ct)).Convertir(AuditoriaResponse.De);
        }

        // Quién movió cada pedido de estado. Los cambios hechos por el sistema (expiración)
        // vienen con usuario null.
        [HttpGet("pedidos")]
        public async Task<ActionResult<Pagina<CambioEstadoPedido>>> CambiosDeEstado(
            [FromQuery] Guid? usuarioId,
            [FromQuery] Guid? pedidoId,
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default)
        {
            if (RangoInvalido(desde, hasta) is { } invalido)
            {
                return invalido;
            }

            var filtro = new FiltroCambiosEstado(usuarioId, pedidoId, Fechas.AUtc(desde), Fechas.AUtc(hasta));
            return await auditoria.ListarCambiosEstadoAsync(filtro, pagina, tamano, ct);
        }

        private ActionResult? RangoInvalido(DateTime? desde, DateTime? hasta)
        {
            if (desde is not null && hasta is not null && Fechas.AUtc(desde) >= Fechas.AUtc(hasta))
            {
                ModelState.AddModelError(nameof(hasta), "hasta debe ser posterior a desde.");
                return ValidationProblem(ModelState);
            }
            return null;
        }
    }
}
