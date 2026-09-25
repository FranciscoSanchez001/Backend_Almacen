using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Configuración de la tienda (solo superadmin): tasa del día y su historial, número de
    // soporte, datos de pago, horas de expiración y lista blanca de WhatsApp.
    [ApiController]
    [Route("configuracion")]
    [Authorize(Roles = Roles.Superadmin)]
    public class ConfiguracionController(
        IConfiguracionRepository configuracion,
        IUnitOfWork unidad,
        AuditoriaService auditoria) : ControllerBase
    {
        [HttpGet]
        public async Task<ConfiguracionResponse> Obtener(CancellationToken ct) =>
            ConfiguracionResponse.De(await configuracion.ObtenerAsync(ct));

        // Las horas de expiración nuevas aplican a los pedidos que se creen desde ahora; los
        // pendientes conservan su expira_en.
        [HttpPut]
        public async Task<ActionResult<ConfiguracionResponse>> Actualizar(ActualizarConfiguracionRequest req,
            CancellationToken ct)
        {
            var numerosPrueba = new List<string>();
            foreach (var numero in req.NumerosPrueba ?? [])
            {
                var normalizado = Telefonos.NormalizarVenezolano(numero);
                if (normalizado is null)
                {
                    ModelState.AddModelError(nameof(req.NumerosPrueba),
                        $"\"{numero}\" no es un celular venezolano válido (+58 4XX XXX XXXX).");
                }
                else if (!numerosPrueba.Contains(normalizado))
                {
                    numerosPrueba.Add(normalizado);
                }
            }
            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            var config = await configuracion.ObtenerParaEditarAsync(ct);
            var antes = ConfiguracionAuditoria.De(config);

            config.NumeroSoporte = Limpiar(req.NumeroSoporte);
            config.HorasExpiracion = req.HorasExpiracion;
            config.DatosTransferencia = Limpiar(req.DatosTransferencia);
            config.DatosPagoMovil = Limpiar(req.DatosPagoMovil);
            config.WalletBinance = Limpiar(req.WalletBinance);
            config.NumerosPrueba = numerosPrueba;

            var despues = ConfiguracionAuditoria.De(config);
            if (despues != antes)
            {
                auditoria.Registrar(User.GetUsuarioId(), Entidades.Configuracion, config.Id, AccionAuditoria.Editar,
                    antes, despues);
                await unidad.GuardarCambiosAsync(ct);
            }

            return ConfiguracionResponse.De(config);
        }

        // Carga la tasa del día. Cada carga queda en historial_tasas; los pedidos ya creados
        // conservan la tasa congelada con la que se hicieron.
        [HttpPut("tasa")]
        public async Task<ActionResult<HistorialTasaResponse>> CargarTasa(TasaRequest req, CancellationToken ct)
        {
            var tasa = Math.Round(req.Tasa, 4, MidpointRounding.AwayFromZero);
            if (tasa <= 0)
            {
                ModelState.AddModelError(nameof(req.Tasa), "La tasa debe ser mayor que 0.");
                return ValidationProblem(ModelState);
            }

            var config = await configuracion.ObtenerParaEditarAsync(ct);
            var registro = new HistorialTasa
            {
                Id = Guid.CreateVersion7(),
                Tasa = tasa,
                UsuarioId = User.GetUsuarioId(),
                CreatedAt = DateTime.UtcNow,
            };

            // Un solo SaveChanges: la tasa actual y su historial se guardan juntos o no se guardan.
            config.TasaBsUsd = tasa;
            configuracion.AgregarTasa(registro);
            await unidad.GuardarCambiosAsync(ct);

            return new HistorialTasaResponse(registro.Id, registro.Tasa, registro.UsuarioId,
                User.Identity?.Name ?? "", registro.CreatedAt);
        }

        [HttpGet("tasas")]
        public async Task<Pagina<HistorialTasaResponse>> HistorialTasas(
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 30,
            CancellationToken ct = default) =>
            (await configuracion.ListarTasasAsync(pagina, tamano, ct)).Convertir(HistorialTasaResponse.De);

        private static string? Limpiar(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
    }
}
