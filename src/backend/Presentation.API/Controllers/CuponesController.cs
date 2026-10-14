using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Dtos;
using Core.Application.Servicios;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Cupones de descuento (solo superadmin: afectan los ingresos). No se borran porque los
    // pedidos los referencian: se desactivan. El cliente los usa en el checkout
    // (POST /pedidos/cotizar y POST /pedidos con codigoCupon).
    [ApiController]
    [Route("cupones")]
    [Authorize(Roles = Roles.Superadmin)]
    public class CuponesController(
        ICuponRepository cupones,
        CuponService servicio) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<CuponResponse>> Listar(
            [FromQuery] string? q,
            [FromQuery] bool? activo,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default) =>
            (await cupones.ListarAsync(new FiltroCupones(q, activo), pagina, tamano, ct)).Convertir(CuponResponse.De);

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<CuponResponse>> Obtener(Guid id, CancellationToken ct) =>
            await cupones.ObtenerAsync(id, ct) is { } cupon ? CuponResponse.De(cupon) : NotFound();

        [HttpPost]
        public async Task<ActionResult<CuponResponse>> Crear(CrearCuponRequest req, CancellationToken ct)
        {
            var id = await servicio.CrearAsync(req, User.GetUsuarioId(), ct);
            return CreatedAtAction(nameof(Obtener), new { id }, CuponResponse.De((await cupones.ObtenerAsync(id, ct))!));
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<CuponResponse>> Actualizar(Guid id, ActualizarCuponRequest req, CancellationToken ct)
        {
            await servicio.ActualizarAsync(id, req, User.GetUsuarioId(), ct);
            return await cupones.ObtenerAsync(id, ct) is { } cupon ? CuponResponse.De(cupon) : NotFound();
        }
    }
}
