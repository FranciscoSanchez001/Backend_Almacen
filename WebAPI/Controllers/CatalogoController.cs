using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.WebAPI.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.WebAPI.Controllers
{
    // Catálogo público de la tienda: solo productos activos con stock disponible.
    [ApiController]
    [Route("catalogo")]
    [AllowAnonymous]
    public class CatalogoController(
        IProductoRepository productos,
        IZonaRepository zonas,
        TasaService tasas) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<CatalogoItem>> Listar(
            [FromQuery] string? q,
            [FromQuery] Guid? categoriaId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 24,
            CancellationToken ct = default)
        {
            var resultado = await productos.ListarAsync(
                new FiltroProductos(q, categoriaId, SoloVisiblesEnTienda: true), pagina, tamano, ct);
            var tasa = await tasas.ObtenerActualAsync(ct);
            return resultado.Convertir(p => CatalogoItem.De(p, tasa));
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<CatalogoItem>> Obtener(Guid id, CancellationToken ct)
        {
            var producto = await productos.ObtenerAsync(id, soloVisiblesEnTienda: true, ct);
            return producto is null ? NotFound() : CatalogoItem.De(producto, await tasas.ObtenerActualAsync(ct));
        }

        // Para el paso 3 del checkout (lista desplegable de zonas).
        [HttpGet("zonas")]
        public async Task<IEnumerable<ZonaResponse>> Zonas(CancellationToken ct) =>
            (await zonas.ListarActivasAsync(ct)).Select(z => new ZonaResponse(z.Id, z.Nombre));
    }
}
