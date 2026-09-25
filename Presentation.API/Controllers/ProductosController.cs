using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Gestión de productos del panel de ventas y del superadmin. El catálogo público está en CatalogoController.
    [ApiController]
    [Route("productos")]
    [Authorize(Roles = Roles.Personal)]
    public class ProductosController(
        IProductoRepository productos,
        ICategoriaRepository categorias,
        IUnitOfWork unidad,
        InventarioService inventario,
        AuditoriaService auditoria,
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

        [HttpPost]
        public async Task<ActionResult<ProductoResponse>> Crear(CrearProductoRequest req, CancellationToken ct)
        {
            var sku = NormalizarSku(req.CodigoSku);
            if (await ValidarAsync(sku, req.CategoriaId, null, ct) is { } invalido)
            {
                return invalido;
            }

            var usuarioId = User.GetUsuarioId();
            var producto = new Producto
            {
                Id = Guid.CreateVersion7(),
                CodigoSku = sku,
                Nombre = req.Nombre.Trim(),
                Descripcion = req.Descripcion?.Trim(),
                PrecioUsd = Redondear(req.PrecioUsd),
                CostoUsd = Redondear(req.CostoUsd),
                ImagenUrl = req.ImagenUrl,
                CategoriaId = req.CategoriaId,
                StockDisponible = req.StockInicial,
                CreadoPorId = usuarioId,
            };

            await using var tx = await unidad.IniciarTransaccionAsync(ct);
            productos.Agregar(producto);
            if (req.StockInicial > 0)
            {
                inventario.RegistrarStockInicial(producto.Id, req.StockInicial, usuarioId);
            }
            auditoria.Registrar(usuarioId, Entidades.Producto, producto.Id, AccionAuditoria.Crear,
                null, ProductoAuditoria.De(producto));
            await unidad.GuardarCambiosAsync(ct);
            await tx.ConfirmarAsync(ct);

            return CreatedAtAction(nameof(Obtener), new { id = producto.Id }, await ObtenerResponseAsync(producto.Id, ct));
        }

        // Ventas y superadmin pueden editar; cada cambio queda en la auditoría con el antes y el después.
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ProductoResponse>> Actualizar(Guid id, ActualizarProductoRequest req,
            CancellationToken ct)
        {
            var producto = await productos.ObtenerActivoParaEditarAsync(id, ct);
            if (producto is null)
            {
                return NotFound();
            }
            var sku = NormalizarSku(req.CodigoSku);
            if (await ValidarAsync(sku, req.CategoriaId, id, ct) is { } invalido)
            {
                return invalido;
            }

            var usuarioId = User.GetUsuarioId();
            var antes = ProductoAuditoria.De(producto);

            await using var tx = await unidad.IniciarTransaccionAsync(ct);

            if (req.StockDisponible is int nuevoStock && nuevoStock != producto.StockDisponible)
            {
                if (!await inventario.AjustarAsync(id, producto.StockDisponible, nuevoStock, usuarioId, ct))
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

            producto.CodigoSku = sku;
            producto.Nombre = req.Nombre.Trim();
            producto.Descripcion = req.Descripcion?.Trim();
            producto.PrecioUsd = Redondear(req.PrecioUsd);
            producto.CostoUsd = Redondear(req.CostoUsd);
            producto.ImagenUrl = req.ImagenUrl;
            producto.CategoriaId = req.CategoriaId;

            var despues = ProductoAuditoria.De(producto);
            if (despues != antes)
            {
                producto.ActualizadoEn = DateTime.UtcNow;
                auditoria.Registrar(usuarioId, Entidades.Producto, id, AccionAuditoria.Editar, antes, despues);
                await unidad.GuardarCambiosAsync(ct);
                await tx.ConfirmarAsync(ct);
            }

            return await ObtenerResponseAsync(id, ct) is { } response ? response : NotFound();
        }

        // Borrado lógico: el producto desaparece de la tienda y del panel, pero el historial
        // de pedidos, movimientos y auditoría lo sigue referenciando.
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = Roles.Superadmin)]
        public async Task<IActionResult> Borrar(Guid id, CancellationToken ct)
        {
            var producto = await productos.ObtenerActivoParaEditarAsync(id, ct);
            if (producto is null)
            {
                return NotFound();
            }

            var antes = ProductoAuditoria.De(producto);
            producto.Activo = false;
            producto.ActualizadoEn = DateTime.UtcNow;
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Producto, id, AccionAuditoria.Borrar,
                antes, ProductoAuditoria.De(producto));
            await unidad.GuardarCambiosAsync(ct);

            return NoContent();
        }

        private async Task<ActionResult?> ValidarAsync(string sku, Guid categoriaId, Guid? productoId, CancellationToken ct)
        {
            if (await productos.SkuEnUsoAsync(sku, productoId, ct))
            {
                return Conflict(new { mensaje = $"Ya existe un producto con el SKU {sku}." });
            }
            if (!await categorias.ExisteAsync(categoriaId, ct))
            {
                ModelState.AddModelError(nameof(CrearProductoRequest.CategoriaId), "La categoría no existe.");
                return ValidationProblem(ModelState);
            }
            return null;
        }

        private async Task<ProductoResponse?> ObtenerResponseAsync(Guid id, CancellationToken ct)
        {
            var producto = await productos.ObtenerAsync(id, ct: ct);
            return producto is null ? null : ProductoResponse.De(producto, await tasas.ObtenerActualAsync(ct));
        }

        private static string NormalizarSku(string sku) => sku.Trim().ToUpperInvariant();

        private static decimal Redondear(decimal monto) => Math.Round(monto, 2, MidpointRounding.AwayFromZero);
    }
}
