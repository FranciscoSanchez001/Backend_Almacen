using System.Linq.Expressions;
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
    // Gestión de productos del panel de ventas y del superadmin. El catálogo público está en CatalogoController.
    [ApiController]
    [Route("productos")]
    [Authorize(Roles = Roles.Personal)]
    public class ProductosController(
        AlmacenDbContext db,
        InventarioService inventario,
        AuditoriaService auditoria,
        TasaService tasas) : ControllerBase
    {
        private static readonly Expression<Func<Producto, ProductoResponse>> AResponse = p => new ProductoResponse(
            p.Id, p.Nombre, p.Descripcion, p.PrecioUsd, null, p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre,
            p.StockDisponible, p.StockReservado, p.Activo, p.CreadoEn, p.ActualizadoEn);

        [HttpGet]
        public async Task<Pagina<ProductoResponse>> Listar(
            [FromQuery] string? q,
            [FromQuery] int? categoriaId,
            [FromQuery] bool incluirInactivos = false,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50)
        {
            var query = db.Productos.AsNoTracking();
            if (!incluirInactivos)
            {
                query = query.Where(p => p.Activo);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                query = query.Where(p => EF.Functions.ILike(p.Nombre, $"%{q.Trim()}%"));
            }
            if (categoriaId is not null)
            {
                query = query.Where(p => p.CategoriaId == categoriaId);
            }

            var resultado = await Pagina<ProductoResponse>.CrearAsync(
                query.OrderBy(p => p.Nombre).ThenBy(p => p.Id).Select(AResponse), pagina, tamano);
            var tasa = await tasas.ObtenerActualAsync();
            return resultado.Map(p => p with { PrecioBs = TasaService.EnBs(p.PrecioUsd, tasa) });
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<ProductoResponse>> Obtener(int id)
        {
            var producto = await ObtenerResponseAsync(id);
            return producto is null ? NotFound() : producto;
        }

        [HttpPost]
        public async Task<ActionResult<ProductoResponse>> Crear(CrearProductoRequest req)
        {
            if (!await db.Categorias.AnyAsync(c => c.Id == req.CategoriaId))
            {
                ModelState.AddModelError(nameof(req.CategoriaId), "La categoría no existe.");
                return ValidationProblem(ModelState);
            }

            var usuarioId = User.GetUsuarioId();
            var producto = new Producto
            {
                Nombre = req.Nombre.Trim(),
                Descripcion = req.Descripcion?.Trim(),
                PrecioUsd = Math.Round(req.PrecioUsd, 2, MidpointRounding.AwayFromZero),
                ImagenUrl = req.ImagenUrl,
                CategoriaId = req.CategoriaId,
                StockDisponible = req.StockInicial,
                CreadoPorId = usuarioId,
            };

            await using var tx = await db.Database.BeginTransactionAsync();
            db.Productos.Add(producto);
            await db.SaveChangesAsync();

            if (req.StockInicial > 0)
            {
                inventario.RegistrarStockInicial(producto.Id, req.StockInicial, usuarioId);
            }
            auditoria.Registrar(usuarioId, Entidades.Producto, producto.Id, AccionAuditoria.Crear,
                null, ProductoAuditoria.De(producto));
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            return CreatedAtAction(nameof(Obtener), new { id = producto.Id }, await ObtenerResponseAsync(producto.Id));
        }

        // Ventas y superadmin pueden editar; cada cambio queda en la auditoría con el antes y el después.
        [HttpPut("{id:int}")]
        public async Task<ActionResult<ProductoResponse>> Actualizar(int id, ActualizarProductoRequest req)
        {
            var producto = await db.Productos.SingleOrDefaultAsync(p => p.Id == id && p.Activo);
            if (producto is null)
            {
                return NotFound();
            }
            if (producto.CategoriaId != req.CategoriaId && !await db.Categorias.AnyAsync(c => c.Id == req.CategoriaId))
            {
                ModelState.AddModelError(nameof(req.CategoriaId), "La categoría no existe.");
                return ValidationProblem(ModelState);
            }

            var usuarioId = User.GetUsuarioId();
            var antes = ProductoAuditoria.De(producto);

            await using var tx = await db.Database.BeginTransactionAsync();

            if (req.StockDisponible is int nuevoStock && nuevoStock != producto.StockDisponible)
            {
                if (!await inventario.AjustarAsync(id, producto.StockDisponible, nuevoStock, usuarioId))
                {
                    return Conflict(new
                    {
                        mensaje = "El stock cambió mientras editabas (por ejemplo, entró o se liberó un pedido). " +
                                  "Vuelve a cargar el producto e inténtalo de nuevo.",
                    });
                }
                // El UPDATE del ajuste dejó la fila bloqueada hasta el commit, así que este valor
                // no puede pisar ningún otro cambio.
                producto.StockDisponible = nuevoStock;
            }

            producto.Nombre = req.Nombre.Trim();
            producto.Descripcion = req.Descripcion?.Trim();
            producto.PrecioUsd = Math.Round(req.PrecioUsd, 2, MidpointRounding.AwayFromZero);
            producto.ImagenUrl = req.ImagenUrl;
            producto.CategoriaId = req.CategoriaId;

            var despues = ProductoAuditoria.De(producto);
            if (despues != antes)
            {
                producto.ActualizadoEn = DateTime.UtcNow;
                auditoria.Registrar(usuarioId, Entidades.Producto, id, AccionAuditoria.Editar, antes, despues);
                await db.SaveChangesAsync();
                await tx.CommitAsync();
            }

            return await ObtenerResponseAsync(id) is { } response ? response : NotFound();
        }

        // Borrado lógico: el producto desaparece de la tienda y del panel, pero el historial
        // de pedidos, movimientos y auditoría lo sigue referenciando.
        [HttpDelete("{id:int}")]
        [Authorize(Roles = Roles.Superadmin)]
        public async Task<IActionResult> Borrar(int id)
        {
            var producto = await db.Productos.SingleOrDefaultAsync(p => p.Id == id && p.Activo);
            if (producto is null)
            {
                return NotFound();
            }

            var antes = ProductoAuditoria.De(producto);
            producto.Activo = false;
            producto.ActualizadoEn = DateTime.UtcNow;
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Producto, id, AccionAuditoria.Borrar,
                antes, ProductoAuditoria.De(producto));
            await db.SaveChangesAsync();

            return NoContent();
        }

        private async Task<ProductoResponse?> ObtenerResponseAsync(int id)
        {
            var producto = await db.Productos.AsNoTracking()
                .Where(p => p.Id == id)
                .Select(AResponse)
                .SingleOrDefaultAsync();
            return producto is null
                ? null
                : producto with { PrecioBs = TasaService.EnBs(producto.PrecioUsd, await tasas.ObtenerActualAsync()) };
        }
    }
}
