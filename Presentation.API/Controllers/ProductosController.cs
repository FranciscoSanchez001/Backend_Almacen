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
    // Gestión de productos del panel de ventas y del superadmin. El catálogo público está en CatalogoController.
    // Las escrituras las hace IProductoService; los errores (404/409/400) los traduce ExceptionMiddleware.
    [ApiController]
    [Route("productos")]
    [Authorize(Roles = Roles.Personal)]
    public class ProductosController(
        IProductoRepository productos,
        IProductoService servicio,
        TasaService tasas) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<ProductoResponse>> Listar(
            [FromQuery] string? q,
            [FromQuery] Guid? categoriaId,
            [FromQuery] bool incluirInactivos = false,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default)
        {
            var resultado = await productos.ListarAsync(
                new FiltroProductos(q, categoriaId, IncluirInactivos: incluirInactivos), pagina, tamano, ct);
            var tasa = await tasas.ObtenerActualAsync(ct);
            return resultado.Convertir(p => ProductoResponse.De(p, tasa));
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ProductoResponse>> Obtener(Guid id, CancellationToken ct)
        {
            var producto = await ObtenerResponseAsync(id, ct);
            return producto is null ? NotFound() : producto;
        }

        // Ventas (Employee) y superadmin (Admin) pueden registrar productos. El cuerpo ya viene
        // validado por CrearProductoValidator: si falla, la petición no llega aquí (400).
        [HttpPost]
        public async Task<ActionResult<ProductoResponse>> Crear(CrearProductoRequest req, CancellationToken ct)
        {
            var id = await servicio.CrearAsync(req, User.GetUsuarioId(), ct);
            return CreatedAtAction(nameof(Obtener), new { id }, await ObtenerResponseAsync(id, ct));
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ProductoResponse>> Actualizar(Guid id, ActualizarProductoRequest req,
            CancellationToken ct)
        {
            await servicio.ActualizarAsync(id, req, User.GetUsuarioId(), ct);
            return await ObtenerResponseAsync(id, ct) is { } response ? response : NotFound();
        }

        // Solo el Admin (superadmin) puede borrar; un Employee (ventas) recibe 403 Forbidden.
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = Roles.Admin)]
        public async Task<IActionResult> Borrar(Guid id, CancellationToken ct)
        {
            await servicio.BorrarAsync(id, User.GetUsuarioId(), ct);
            return NoContent();
        }

        private async Task<ProductoResponse?> ObtenerResponseAsync(Guid id, CancellationToken ct)
        {
            var producto = await productos.ObtenerAsync(id, ct: ct);
            return producto is null ? null : ProductoResponse.De(producto, await tasas.ObtenerActualAsync(ct));
        }
    }
}
