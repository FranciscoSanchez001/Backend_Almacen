using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Domain.Reglas;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Administración > WhatsApp (solo superadmin): vincular por QR el teléfono que envía los
    // mensajes de los pedidos, ver su estado, enviar una prueba y revisar los últimos envíos.
    // La API hace de intermediaria con el servicio de Baileys, que no se publica fuera de Docker.
    [ApiController]
    [Route("whatsapp")]
    [Authorize(Roles = Roles.Superadmin)]
    public class WhatsappController(IClienteWhatsapp whatsapp, IMensajeWhatsappRepository mensajes) : ControllerBase
    {
        [HttpGet("estado")]
        public Task<EstadoWhatsapp> Estado(CancellationToken ct) => whatsapp.EstadoAsync(ct);

        // Sin teléfono vinculado, al rato aparece el QR en GET /whatsapp/estado.
        [HttpPost("vincular")]
        public Task<EstadoWhatsapp> Vincular(CancellationToken ct) => whatsapp.VincularAsync(ct);

        [HttpPost("desvincular")]
        public Task<EstadoWhatsapp> Desvincular(CancellationToken ct) => whatsapp.DesvincularAsync(ct);

        // Envía un mensaje de prueba a cualquier número venezolano (no pasa por la lista blanca:
        // lo pide el gerente a mano para comprobar que el teléfono vinculado funciona).
        [HttpPost("prueba")]
        public async Task<IActionResult> Prueba(PruebaWhatsappRequest req, CancellationToken ct)
        {
            if (Telefonos.NormalizarVenezolano(req.Telefono) is not { } telefono)
            {
                ModelState.AddModelError(nameof(req.Telefono), "Escribe un teléfono venezolano válido (+58 4XX XXX XXXX).");
                return ValidationProblem(ModelState);
            }
            var error = await whatsapp.EnviarAsync(telefono.TrimStart('+'),
                "Mensaje de prueba del Supermercado: el WhatsApp de la tienda está vinculado y funcionando.", ct);
            if (error is not null)
            {
                return Problem(title: "No se pudo enviar", detail: error, statusCode: StatusCodes.Status502BadGateway);
            }
            return NoContent();
        }

        // Últimos mensajes de los pedidos con su estado (enviado, error o bloqueado por la lista blanca).
        [HttpGet("mensajes")]
        public Task<IReadOnlyList<MensajeWhatsappRegistrado>> Mensajes([FromQuery] int limite = 30, CancellationToken ct = default) =>
            mensajes.UltimosAsync(Math.Clamp(limite, 1, 100), ct);
    }
}
