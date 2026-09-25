using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    // Cada operación es un único UPDATE condicional sobre productos (sin leer antes), así que dos
    // pedidos simultáneos no pueden sobrevender. Deben ejecutarse dentro de una transacción.
    public class InventarioRepository(ApplicationDbContext db) : IInventarioRepository
    {
        public Task<int?> ReservarAsync(Guid productoId, int cantidad, CancellationToken ct = default) =>
            ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible - {cantidad},
                       stock_reservado  = stock_reservado  + {cantidad}
                 WHERE id = {productoId} AND activo AND stock_disponible >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """, ct);

        public Task<int?> ConfirmarVentaAsync(Guid productoId, int cantidad, CancellationToken ct = default) =>
            ActualizarAsync($"""
                UPDATE productos
                   SET stock_reservado = stock_reservado - {cantidad}
                 WHERE id = {productoId} AND stock_reservado >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """, ct);

        public Task<int?> LiberarAsync(Guid productoId, int cantidad, CancellationToken ct = default) =>
            ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible + {cantidad},
                       stock_reservado  = stock_reservado  - {cantidad}
                 WHERE id = {productoId} AND stock_reservado >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """, ct);

        public Task<int?> ReponerAsync(Guid productoId, int cantidad, CancellationToken ct = default) =>
            ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible + {cantidad}
                 WHERE id = {productoId} AND activo
                RETURNING stock_disponible AS "Value"
                """, ct);

        public async Task<bool> AjustarAsync(Guid productoId, int disponibleEsperado, int disponibleNuevo,
            CancellationToken ct = default) =>
            await db.Productos
                .Where(p => p.Id == productoId && p.StockDisponible == disponibleEsperado)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockDisponible, disponibleNuevo), ct) > 0;

        public void AgregarMovimiento(MovimientoInventario movimiento) => db.MovimientosInventario.Add(movimiento);

        public Task<Pagina<MovimientoInventario>> ListarMovimientosAsync(Guid productoId, int pagina, int tamano,
            CancellationToken ct = default) =>
            db.MovimientosInventario.AsNoTracking()
                .Include(m => m.Usuario)
                .Where(m => m.ProductoId == productoId)
                .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
                .PaginarAsync(pagina, tamano, ct);

        private async Task<int?> ActualizarAsync(FormattableString sql, CancellationToken ct)
        {
            if (db.Database.CurrentTransaction is null)
            {
                throw new InvalidOperationException("Los cambios de inventario deben hacerse dentro de una transacción.");
            }
            // Sin operadores LINQ encima: EF ejecuta el UPDATE ... RETURNING tal cual.
            var filas = await db.Database.SqlQuery<int>(sql).ToListAsync(ct);
            return filas.Count == 0 ? null : filas[0];
        }
    }
}
