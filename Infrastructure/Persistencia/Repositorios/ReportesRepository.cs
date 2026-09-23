using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
{
    // Proyecciones planas y sin seguimiento; los filtros por creado_en usan el índice
    // pedidos(estado, creado_en).
    public class ReportesRepository(ApplicationDbContext db) : IReportesRepository
    {
        public Task<List<PedidoReporte>> ListarPedidosAsync(DateTime desdeUtc, DateTime hastaUtc,
            CancellationToken ct = default) =>
            db.Pedidos.AsNoTracking()
                .Where(p => p.CreadoEn >= desdeUtc && p.CreadoEn < hastaUtc)
                .Select(p => new PedidoReporte(
                    p.Id,
                    p.Numero,
                    p.Estado,
                    p.MetodoPago,
                    p.MonedaPago,
                    p.TasaCambio,
                    p.TotalUsd,
                    p.TotalBs,
                    p.ClienteId,
                    p.Cliente.Nombre,
                    p.ZonaId,
                    p.Zona.Nombre,
                    p.Latitud,
                    p.Longitud,
                    p.RepartidorId,
                    p.Repartidor != null ? p.Repartidor.Nombre : null,
                    p.CreadoEn,
                    p.RevisadoEn,
                    p.AsignadoEn,
                    p.EntregadoEn))
                .ToListAsync(ct);

        public Task<List<ItemReporte>> ListarItemsVendidosAsync(DateTime desdeUtc, DateTime hastaUtc,
            CancellationToken ct = default) =>
            db.PedidoItems.AsNoTracking()
                .Where(i => i.Pedido.CreadoEn >= desdeUtc && i.Pedido.CreadoEn < hastaUtc
                    && TransicionesPedido.CuentanComoVenta.Contains(i.Pedido.Estado))
                .Select(i => new ItemReporte(
                    i.PedidoId,
                    i.ProductoId,
                    i.Producto.Nombre,
                    i.CategoriaId,
                    i.Categoria.Nombre,
                    i.Cantidad,
                    i.PrecioUsd,
                    i.PrecioBs))
                .ToListAsync(ct);

        public Task<List<ProductoStock>> ListarProductosActivosAsync(CancellationToken ct = default) =>
            db.Productos.AsNoTracking()
                .Where(p => p.Activo)
                .OrderBy(p => p.Nombre)
                .Select(p => new ProductoStock(p.Id, p.Nombre, p.Categoria.Nombre, p.StockDisponible, p.StockReservado))
                .ToListAsync(ct);

        // Los movimientos en el mismo instante que `momento` ya son del período, así que se toma
        // el stock de antes de ellos (>=).
        public Task<Dictionary<Guid, int>> StockDisponibleEnAsync(DateTime momentoUtc, CancellationToken ct = default) =>
            db.MovimientosInventario.AsNoTracking()
                .Where(m => m.CreadoEn >= momentoUtc)
                .GroupBy(m => m.ProductoId)
                .Select(g => new
                {
                    ProductoId = g.Key,
                    Disponible = g.OrderBy(m => m.CreadoEn).ThenBy(m => m.Id).Select(m => m.DisponibleAntes).First(),
                })
                .ToDictionaryAsync(x => x.ProductoId, x => x.Disponible, ct);
    }
}
