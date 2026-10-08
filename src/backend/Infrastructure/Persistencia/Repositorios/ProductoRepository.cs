using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Domain.Entidades;
using Core.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    public class ProductoRepository(ApplicationDbContext db) : IProductoRepository
    {
        public Task<Pagina<Producto>> ListarAsync(FiltroProductos filtro, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Productos.AsNoTracking().Include(p => p.Categoria).AsQueryable();
            if (filtro.SoloVisiblesEnTienda)
            {
                query = query.Where(p => p.Activo && p.StockDisponible > 0);
            }
            else if (!filtro.IncluirInactivos)
            {
                query = query.Where(p => p.Activo);
            }
            query = Filtrar(query, filtro.Texto, filtro.CategoriaId);

            return query.OrderBy(p => p.Nombre).ThenBy(p => p.Id).PaginarAsync(pagina, tamano, ct);
        }

        // Productos activos con su stock; los agotados primero.
        public Task<List<Producto>> ListarInventarioAsync(string? texto, Guid? categoriaId, bool soloAgotados,
            CancellationToken ct = default)
        {
            var query = db.Productos.AsNoTracking().Include(p => p.Categoria).Where(p => p.Activo);
            if (soloAgotados)
            {
                query = query.Where(p => p.StockDisponible == 0);
            }
            query = Filtrar(query, texto, categoriaId);

            return query.OrderBy(p => p.StockDisponible > 0).ThenBy(p => p.Nombre).ToListAsync(ct);
        }

        public Task<Producto?> ObtenerAsync(Guid id, bool soloVisiblesEnTienda = false, CancellationToken ct = default)
        {
            var query = db.Productos.AsNoTracking().Include(p => p.Categoria).Where(p => p.Id == id);
            if (soloVisiblesEnTienda)
            {
                query = query.Where(p => p.Activo && p.StockDisponible > 0);
            }
            return query.SingleOrDefaultAsync(ct);
        }

        public Task<Producto?> ObtenerActivoParaEditarAsync(Guid id, CancellationToken ct = default) =>
            db.Productos.SingleOrDefaultAsync(p => p.Id == id && p.Activo, ct);

        public Task<Dictionary<Guid, Producto>> ObtenerActivosAsync(IReadOnlyCollection<Guid> ids,
            CancellationToken ct = default) =>
            db.Productos.AsNoTracking()
                .Where(p => ids.Contains(p.Id) && p.Activo)
                .ToDictionaryAsync(p => p.Id, ct);

        public Task<bool> ExisteAsync(Guid id, CancellationToken ct = default) =>
            db.Productos.AnyAsync(p => p.Id == id, ct);

        public Task<bool> SkuEnUsoAsync(string sku, Guid? exceptoId, CancellationToken ct = default) =>
            db.Productos.AnyAsync(p => p.CodigoSku == sku && p.Id != exceptoId, ct);

        public void Agregar(Producto producto) => db.Productos.Add(producto);

        public async Task<List<Producto>> ListarMasVendidosAsync(int limite, CancellationToken ct = default)
        {
            var ids = await ItemsVendidosVisibles()
                .GroupBy(i => i.ProductoId)
                .Select(g => new { ProductoId = g.Key, Unidades = g.Sum(i => i.Cantidad) })
                .OrderByDescending(x => x.Unidades).ThenBy(x => x.ProductoId)
                .Take(limite)
                .Select(x => x.ProductoId)
                .ToListAsync(ct);
            return await CargarEnOrdenAsync(ids, ct);
        }

        // Cada pedido tiene a lo sumo un ítem por producto, así que Count() = número de pedidos.
        public async Task<List<Producto>> ListarCompradosFrecuentesAsync(Guid clienteId, int limite,
            CancellationToken ct = default)
        {
            var ids = await ItemsVendidosVisibles()
                .Where(i => i.Pedido.ClienteId == clienteId)
                .GroupBy(i => i.ProductoId)
                .Select(g => new { ProductoId = g.Key, Pedidos = g.Count(), Unidades = g.Sum(i => i.Cantidad) })
                .OrderByDescending(x => x.Pedidos).ThenByDescending(x => x.Unidades).ThenBy(x => x.ProductoId)
                .Take(limite)
                .Select(x => x.ProductoId)
                .ToListAsync(ct);
            return await CargarEnOrdenAsync(ids, ct);
        }

        public async Task<List<Producto>> ListarCompradosRecientesAsync(Guid clienteId, int limite,
            CancellationToken ct = default)
        {
            // Join explícito con pedidos: con la navegación i.Pedido, EF pone el MAX en una
            // subconsulta correlacionada; así queda ORDER BY max(creado_en) en el mismo GROUP BY.
            var ids = await (
                    from i in ItemsVendidosVisibles()
                    join p in db.Pedidos on i.PedidoId equals p.Id
                    where p.ClienteId == clienteId
                    group p.CreatedAt by i.ProductoId into g
                    orderby g.Max() descending, g.Key
                    select g.Key)
                .Take(limite)
                .ToListAsync(ct);
            return await CargarEnOrdenAsync(ids, ct);
        }

        private IQueryable<PedidoItem> ItemsVendidosVisibles() =>
            db.PedidoItems.AsNoTracking()
                .Where(i => TransicionesPedido.CuentanComoVenta.Contains(i.Pedido.Estado)
                    && i.Producto.Activo && i.Producto.StockDisponible > 0);

        // Carga los productos respetando el orden del ranking.
        private async Task<List<Producto>> CargarEnOrdenAsync(List<Guid> ids, CancellationToken ct)
        {
            if (ids.Count == 0)
            {
                return [];
            }
            var productos = await db.Productos.AsNoTracking()
                .Include(p => p.Categoria)
                .Where(p => ids.Contains(p.Id) && p.Activo && p.StockDisponible > 0)
                .ToDictionaryAsync(p => p.Id, ct);
            return ids.Where(productos.ContainsKey).Select(id => productos[id]).ToList();
        }

        // Búsqueda por nombre o SKU.
        private static IQueryable<Producto> Filtrar(IQueryable<Producto> query, string? texto, Guid? categoriaId)
        {
            if (!string.IsNullOrWhiteSpace(texto))
            {
                var patron = $"%{texto.Trim()}%";
                query = query.Where(p => EF.Functions.ILike(p.Nombre, patron) || EF.Functions.ILike(p.CodigoSku, patron));
            }
            if (categoriaId is not null)
            {
                query = query.Where(p => p.CategoriaId == categoriaId);
            }
            return query;
        }
    }
}
