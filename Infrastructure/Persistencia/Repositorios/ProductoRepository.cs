using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
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
