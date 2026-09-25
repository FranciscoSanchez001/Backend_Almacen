using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Catálogo público de la tienda: solo productos activos con stock disponible. [AllowAnonymous]
    // va en cada acción y no en la clase, porque en la clase anularía el [Authorize] de /pago.
    [ApiController]
    [Route("catalogo")]
    public class CatalogoController(
        IProductoRepository productos,
        IZonaRepository zonas,
        IConfiguracionRepository configuracion,
        TasaService tasas) : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
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
        [AllowAnonymous]
        public async Task<ActionResult<CatalogoItem>> Obtener(Guid id, CancellationToken ct)
        {
            var producto = await productos.ObtenerAsync(id, soloVisiblesEnTienda: true, ct);
            return producto is null ? NotFound() : CatalogoItem.De(producto, await tasas.ObtenerActualAsync(ct));
        }

        // Inicio de la tienda: los más vendidos para todos y, si entra un cliente, "los que compras
        // siempre" y "tus últimas compras". Es anónimo, pero si llega un token válido se usa.
        [HttpGet("inicio")]
        [AllowAnonymous]
        public async Task<InicioTiendaResponse> Inicio([FromQuery] int limite = 10, CancellationToken ct = default)
        {
            limite = Math.Clamp(limite, 1, 30);
            var tasa = await tasas.ObtenerActualAsync(ct);
            List<CatalogoItem> Convertir(List<Producto> lista) => lista.Select(p => CatalogoItem.De(p, tasa)).ToList();

            var masVendidos = Convertir(await productos.ListarMasVendidosAsync(limite, ct));
            if (!User.IsInRole(Roles.Cliente))
            {
                return new InicioTiendaResponse(masVendidos, [], []);
            }

            var clienteId = User.GetUsuarioId();
            return new InicioTiendaResponse(
                masVendidos,
                Convertir(await productos.ListarCompradosFrecuentesAsync(clienteId, limite, ct)),
                Convertir(await productos.ListarCompradosRecientesAsync(clienteId, limite, ct)));
        }

        // Paso 1 del checkout: cuentas, pago móvil, wallet y tasa. Pide sesión para no exponer los
        // datos bancarios a cualquiera.
        [HttpGet("pago")]
        [Authorize]
        public async Task<DatosPagoResponse> DatosPago(CancellationToken ct) =>
            DatosPagoResponse.De(await configuracion.ObtenerAsync(ct));

        // Para el paso 3 del checkout (lista desplegable de zonas).
        [HttpGet("zonas")]
        [AllowAnonymous]
        public async Task<IEnumerable<ZonaResponse>> Zonas(CancellationToken ct) =>
            (await zonas.ListarActivasAsync(ct)).Select(z => new ZonaResponse(z.Id, z.Nombre));
    }
}
