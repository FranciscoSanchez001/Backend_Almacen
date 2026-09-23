using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Domain.Enums;
using Backend_Almacen.WebAPI.Auth;
using Backend_Almacen.WebAPI.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.WebAPI.Controllers
{
    [ApiController]
    [Route("inventario")]
    [Authorize(Roles = Roles.Personal)]
    public class InventarioController(
        IProductoRepository productos,
        IInventarioRepository movimientos,
        IUnitOfWork unidad,
        InventarioService inventario,
        AuditoriaService auditoria) : ControllerBase
    {
        // Stock disponible y reservado de cada producto activo; los agotados primero.
        [HttpGet]
        public async Task<IEnumerable<InventarioItem>> Listar(
            [FromQuery] string? q,
            [FromQuery] Guid? categoriaId,
            [FromQuery] bool soloAgotados = false,
            CancellationToken ct = default) =>
            (await productos.ListarInventarioAsync(q, categoriaId, soloAgotados, ct)).Select(InventarioItem.De);

        // Llegó mercancía: suma al disponible y el producto vuelve a aparecer en la tienda.
        [HttpPost("{productoId:guid}/reponer")]
        public async Task<ActionResult<InventarioItem>> Reponer(Guid productoId, ReponerRequest req, CancellationToken ct)
        {
            var usuarioId = User.GetUsuarioId();

            await using var tx = await unidad.IniciarTransaccionAsync(ct);
            var disponible = await inventario.ReponerAsync(productoId, req.Cantidad, usuarioId, ct);
            if (disponible is null)
            {
                return NotFound();
            }

            auditoria.Registrar(usuarioId, Entidades.Producto, productoId, AccionAuditoria.Editar,
                new { StockDisponible = disponible - req.Cantidad },
                new { StockDisponible = disponible });
            await unidad.GuardarCambiosAsync(ct);
            await tx.ConfirmarAsync(ct);

            return InventarioItem.De((await productos.ObtenerAsync(productoId, ct: ct))!);
        }

        [HttpGet("{productoId:guid}/movimientos")]
        public async Task<ActionResult<Pagina<MovimientoResponse>>> Movimientos(
            Guid productoId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default)
        {
            if (!await productos.ExisteAsync(productoId, ct))
            {
                return NotFound();
            }
            return (await movimientos.ListarMovimientosAsync(productoId, pagina, tamano, ct)).Convertir(MovimientoResponse.De);
        }
    }
}
