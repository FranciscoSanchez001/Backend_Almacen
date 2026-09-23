using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Dtos;
using Backend_Almacen.Models;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    [ApiController]
    [Route("inventario")]
    [Authorize(Roles = Roles.Personal)]
    public class InventarioController(
        AlmacenDbContext db,
        InventarioService inventario,
        AuditoriaService auditoria) : ControllerBase
    {
        // Stock disponible y reservado de cada producto activo; los agotados primero.
        [HttpGet]
        public async Task<List<InventarioItem>> Listar(
            [FromQuery] string? q,
            [FromQuery] int? categoriaId,
            [FromQuery] bool soloAgotados = false)
        {
            var query = db.Productos.AsNoTracking().Where(p => p.Activo);
            if (soloAgotados)
            {
                query = query.Where(p => p.StockDisponible == 0);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                query = query.Where(p => EF.Functions.ILike(p.Nombre, $"%{q.Trim()}%"));
            }
            if (categoriaId is not null)
            {
                query = query.Where(p => p.CategoriaId == categoriaId);
            }

            return await query
                .OrderBy(p => p.StockDisponible > 0).ThenBy(p => p.Nombre)
                .Select(p => new InventarioItem(p.Id, p.Nombre, p.Categoria.Nombre,
                    p.StockDisponible, p.StockReservado, p.StockDisponible == 0))
                .ToListAsync();
        }

        // Llegó mercancía: suma al disponible y el producto vuelve a aparecer en la tienda.
        [HttpPost("{productoId:int}/reponer")]
        public async Task<ActionResult<InventarioItem>> Reponer(int productoId, ReponerRequest req)
        {
            var usuarioId = User.GetUsuarioId();

            await using var tx = await db.Database.BeginTransactionAsync();
            var disponible = await inventario.ReponerAsync(productoId, req.Cantidad, usuarioId);
            if (disponible is null)
            {
                return NotFound();
            }

            auditoria.Registrar(usuarioId, Entidades.Producto, productoId, AccionAuditoria.Editar,
                new { StockDisponible = disponible - req.Cantidad },
                new { StockDisponible = disponible });
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            return await db.Productos.AsNoTracking()
                .Where(p => p.Id == productoId)
                .Select(p => new InventarioItem(p.Id, p.Nombre, p.Categoria.Nombre,
                    p.StockDisponible, p.StockReservado, p.StockDisponible == 0))
                .SingleAsync();
        }

        [HttpGet("{productoId:int}/movimientos")]
        public async Task<ActionResult<Pagina<MovimientoResponse>>> Movimientos(
            int productoId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50)
        {
            if (!await db.Productos.AnyAsync(p => p.Id == productoId))
            {
                return NotFound();
            }

            var query = db.MovimientosInventario.AsNoTracking()
                .Where(m => m.ProductoId == productoId)
                .OrderByDescending(m => m.CreadoEn).ThenByDescending(m => m.Id)
                .Select(m => new MovimientoResponse(m.Id, m.Tipo, m.Cantidad, m.DisponibleAntes,
                    m.DisponibleDespues, m.PedidoId, m.UsuarioId,
                    m.Usuario == null ? null : m.Usuario.Nombre, m.CreadoEn));

            return await Pagina<MovimientoResponse>.CrearAsync(query, pagina, tamano);
        }
    }
}
