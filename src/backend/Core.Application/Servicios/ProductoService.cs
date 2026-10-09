using Core.Application.Abstracciones;
using Core.Application.Dtos;
using Core.Application.Excepciones;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Servicios
{
    // Casos de uso de escritura sobre productos (panel de ventas y superadmin). Los datos ya llegan
    // validados por FluentValidation; aquí van las reglas que dependen de la base de datos.
    // Errores: KeyNotFoundException (404), ConflictoException (409), InvalidOperationException (400).
    public interface IProductoService
    {
        Task<Guid> CrearAsync(CrearProductoRequest req, Guid usuarioId, CancellationToken ct = default);
        Task ActualizarAsync(Guid id, ActualizarProductoRequest req, Guid usuarioId, CancellationToken ct = default);
        Task BorrarAsync(Guid id, Guid usuarioId, CancellationToken ct = default);
    }

    public class ProductoService(
        IProductoRepository productos,
        ICategoriaRepository categorias,
        IUnitOfWork unidad,
        InventarioService inventario,
        AuditoriaService auditoria) : IProductoService
    {
        public async Task<Guid> CrearAsync(CrearProductoRequest req, Guid usuarioId, CancellationToken ct = default)
        {
            var sku = NormalizarSku(req.CodigoSku);
            await VerificarAsync(sku, req.CategoriaId, null, ct);

            var producto = new Producto
            {
                Id = Guid.CreateVersion7(),
                CodigoSku = sku,
                Nombre = req.Nombre,
                StockDisponible = req.StockInicial,
                CreadoPorId = usuarioId,
            };
            Copiar(req, producto);

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

            return producto.Id;
        }

        // Cada cambio queda en la auditoría con el antes y el después.
        public async Task ActualizarAsync(Guid id, ActualizarProductoRequest req, Guid usuarioId,
            CancellationToken ct = default)
        {
            var producto = await productos.ObtenerActivoParaEditarAsync(id, ct)
                ?? throw new KeyNotFoundException("El producto no existe.");
            var sku = NormalizarSku(req.CodigoSku);
            await VerificarAsync(sku, req.CategoriaId, id, ct);

            var antes = ProductoAuditoria.De(producto);

            await using var tx = await unidad.IniciarTransaccionAsync(ct);

            if (req.StockDisponible is int nuevoStock && nuevoStock != producto.StockDisponible)
            {
                if (!await inventario.AjustarAsync(id, producto.StockDisponible, nuevoStock, usuarioId, ct))
                {
                    throw new ConflictoException(
                        "El stock cambió mientras editabas (por ejemplo, entró o se liberó un pedido). " +
                        "Vuelve a cargar el producto e inténtalo de nuevo.");
                }
                // El UPDATE del ajuste dejó la fila bloqueada hasta el commit, así que este valor
                // no puede pisar ningún otro cambio.
                producto.StockDisponible = nuevoStock;
            }

            producto.CodigoSku = sku;
            Copiar(req, producto);

            var despues = ProductoAuditoria.De(producto);
            if (despues != antes)
            {
                producto.ActualizadoEn = DateTime.UtcNow;
                auditoria.Registrar(usuarioId, Entidades.Producto, id, AccionAuditoria.Editar, antes, despues);
                await unidad.GuardarCambiosAsync(ct);
                await tx.ConfirmarAsync(ct);
            }
        }

        // Borrado lógico: el producto desaparece de la tienda y del panel, pero el historial
        // de pedidos, movimientos y auditoría lo sigue referenciando.
        public async Task BorrarAsync(Guid id, Guid usuarioId, CancellationToken ct = default)
        {
            var producto = await productos.ObtenerActivoParaEditarAsync(id, ct)
                ?? throw new KeyNotFoundException("El producto no existe.");

            var antes = ProductoAuditoria.De(producto);
            producto.Activo = false;
            producto.ActualizadoEn = DateTime.UtcNow;
            auditoria.Registrar(usuarioId, Entidades.Producto, id, AccionAuditoria.Borrar,
                antes, ProductoAuditoria.De(producto));
            await unidad.GuardarCambiosAsync(ct);
        }

        private async Task VerificarAsync(string sku, Guid categoriaId, Guid? productoId, CancellationToken ct)
        {
            if (await productos.SkuEnUsoAsync(sku, productoId, ct))
            {
                throw new ConflictoException($"Ya existe un producto con el SKU {sku}.");
            }
            if (!await categorias.ExisteAsync(categoriaId, ct))
            {
                throw new InvalidOperationException("La categoría no existe.");
            }
        }

        private static void Copiar(IDatosProducto datos, Producto producto)
        {
            producto.Nombre = datos.Nombre.Trim();
            producto.Descripcion = datos.Descripcion?.Trim();
            producto.PrecioUsd = Redondear(datos.PrecioUsd);
            producto.CostoUsd = Redondear(datos.CostoUsd);
            producto.ImagenUrl = datos.ImagenUrl;
            producto.CategoriaId = datos.CategoriaId;
            producto.StockMinimo = datos.StockMinimo;
            producto.StockMaximo = datos.StockMaximo;
            producto.Ubicacion = string.IsNullOrWhiteSpace(datos.Ubicacion) ? null : datos.Ubicacion.Trim();
            producto.UnidadMedida = datos.UnidadMedida.Trim().ToLowerInvariant();
        }

        private static string NormalizarSku(string sku) => sku.Trim().ToUpperInvariant();

        private static decimal Redondear(decimal monto) => Math.Round(monto, 2, MidpointRounding.AwayFromZero);
    }
}
