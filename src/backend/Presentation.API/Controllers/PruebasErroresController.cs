using Presentation.API.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Endpoint que provoca errores a propósito para probar el ExceptionMiddleware (RFC 7807).
    // Cada ruta lanza una excepción distinta; la respuesta la arma el middleware. Solo Admin.
    [ApiController]
    [Route("pruebas/errores")]
    [Authorize(Roles = Roles.Admin)]
    public class PruebasErroresController : ControllerBase
    {
        // 404: KeyNotFoundException.
        [HttpGet("no-encontrado")]
        public IActionResult NoEncontrado() =>
            throw new KeyNotFoundException("No existe el producto con id 00000000-0000-0000-0000-000000000000.");

        // 400: InvalidOperationException.
        [HttpGet("operacion-invalida")]
        public IActionResult OperacionInvalida() =>
            throw new InvalidOperationException("No se puede aprobar un pedido que ya fue entregado.");

        // 500: cualquier otra excepción. El mensaje interno no debe llegar al cliente.
        [HttpGet("interno")]
        public IActionResult Interno() =>
            throw new NullReferenceException("Detalle interno que el cliente nunca debe ver.");
    }
}
