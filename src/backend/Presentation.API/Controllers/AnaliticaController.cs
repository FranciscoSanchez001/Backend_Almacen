using System.Security.Claims;
using System.Text.RegularExpressions;
using Core.Application.Dtos;
using Core.Application.Modelos;
using Core.Application.Servicios;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Presentation.API.Controllers
{
    // Analítica de comportamiento de la tienda. El navegador manda los eventos por lotes (anónimo,
    // con límite de peticiones por IP) y el gerente ve el resumen en /admin/comportamiento.
    [ApiController]
    [Route("analitica")]
    public partial class AnaliticaController(
        AnaliticaService analitica,
        ReportesService reportes) : ControllerBase
    {
        // Encabezado con el que el navegador identifica la visita también en GET /catalogo.
        public const string EncabezadoSesion = "X-Sesion-Analitica";
        public const string PoliticaLimite = "analitica";

        // Responde 204 aunque descarte el lote: al navegador no le importa el resultado.
        [HttpPost("eventos")]
        [AllowAnonymous]
        [EnableRateLimiting(PoliticaLimite)]
        public async Task<IActionResult> Registrar(RegistrarEventosRequest req, CancellationToken ct)
        {
            if (EsCliente(User, out var clienteId))
            {
                await analitica.RegistrarAsync(req.SesionId, clienteId, req.Eventos, ct);
            }
            return NoContent();
        }

        // Mismos períodos que /kpis: tipo=diario|semanal|mensual|personalizado, desde y hasta
        // (fechas locales de la tienda). Sin parámetros, el mes en curso.
        [HttpGet("comportamiento")]
        [Authorize(Roles = Roles.Superadmin)]
        public async Task<ActionResult<Comportamiento>> Comportamiento(
            [FromQuery] TipoReporte? tipo,
            [FromQuery] DateOnly? desde,
            [FromQuery] DateOnly? hasta,
            CancellationToken ct)
        {
            var resultado = reportes.ResolverPeriodo(tipo, desde, hasta);
            if (resultado.Periodo is null)
            {
                ModelState.AddModelError("periodo", resultado.Error!);
                return ValidationProblem(ModelState);
            }
            return await analitica.CalcularAsync(resultado.Periodo, ct);
        }

        // Solo se mide a los visitantes: anónimos o clientes. El personal que entra a la tienda
        // (para revisar algo) no cuenta. clienteId queda en null si es anónimo.
        public static bool EsCliente(ClaimsPrincipal user, out Guid? clienteId)
        {
            clienteId = null;
            if (user.Identity?.IsAuthenticated != true)
            {
                return true;
            }
            if (!user.IsInRole(Roles.Cliente))
            {
                return false;
            }
            clienteId = user.GetUsuarioIdOrNull();
            return true;
        }

        // El id de la visita que mandó el navegador en el encabezado, o null si no vino o no es válido
        // (por ejemplo, el visitante activó "No rastrear" y el navegador no lo manda).
        public static string? SesionDe(HttpRequest request)
        {
            var valor = request.Headers[EncabezadoSesion].ToString();
            return SesionValida().IsMatch(valor) ? valor : null;
        }

        [GeneratedRegex("^[A-Za-z0-9-]{8,64}$")]
        private static partial Regex SesionValida();
    }
}
