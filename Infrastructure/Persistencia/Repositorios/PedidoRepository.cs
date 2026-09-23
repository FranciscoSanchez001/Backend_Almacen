using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
{
    public class PedidoRepository(ApplicationDbContext db) : IPedidoRepository
    {
        private IQueryable<Pedido> ConDetalle() => db.Pedidos.AsNoTracking()
            .Include(p => p.Cliente)
            .Include(p => p.Zona)
            .Include(p => p.RevisadoPor)
            .Include(p => p.Repartidor)
            .Include(p => p.Items).ThenInclude(i => i.Producto)
            .Include(p => p.Items).ThenInclude(i => i.Categoria)
            .Include(p => p.HistorialEstados).ThenInclude(h => h.Usuario)
            .AsSplitQuery();

        public Task<Pedido?> ObtenerDetalleAsync(Guid id, CancellationToken ct = default) =>
            ConDetalle().SingleOrDefaultAsync(p => p.Id == id, ct);

        public Task<Pagina<Pedido>> ListarAsync(FiltroPedidos filtro, int pagina, int tamano, CancellationToken ct = default)
        {
            var query = ConDetalle();
            if (filtro.Estados is { Count: > 0 } estados)
            {
                query = query.Where(p => estados.Contains(p.Estado));
            }
            if (filtro.ClienteId is not null)
            {
                query = query.Where(p => p.ClienteId == filtro.ClienteId);
            }
            if (filtro.RepartidorId is not null)
            {
                query = query.Where(p => p.RepartidorId == filtro.RepartidorId);
            }
            if (filtro.ZonaId is not null)
            {
                query = query.Where(p => p.ZonaId == filtro.ZonaId);
            }
            if (filtro.Desde is not null)
            {
                query = query.Where(p => p.CreadoEn >= filtro.Desde);
            }
            if (filtro.Hasta is not null)
            {
                query = query.Where(p => p.CreadoEn < filtro.Hasta);
            }

            var ordenada = filtro.Orden switch
            {
                OrdenPedidos.MasUrgentes => query.OrderBy(p => p.ExpiraEn).ThenBy(p => p.Numero),
                OrdenPedidos.PorAsignacion => query.OrderBy(p => p.AsignadoEn).ThenBy(p => p.Numero),
                OrdenPedidos.PorEntrega => query.OrderByDescending(p => p.EntregadoEn).ThenByDescending(p => p.Numero),
                _ => query.OrderByDescending(p => p.CreadoEn).ThenByDescending(p => p.Numero),
            };
            return ordenada.PaginarAsync(pagina, tamano, ct);
        }

        public async Task<Pedido?> BloquearParaActualizarAsync(Guid id, CancellationToken ct = default)
        {
            var bloqueados = await db.Database
                .SqlQuery<int>($"SELECT 1 AS \"Value\" FROM pedidos WHERE id = {id} FOR UPDATE")
                .ToListAsync(ct);
            if (bloqueados.Count == 0)
            {
                return null;
            }

            return await db.Pedidos
                .Include(p => p.Items)
                .Include(p => p.Cliente)
                .Include(p => p.Zona)
                .SingleAsync(p => p.Id == id, ct);
        }

        public Task<List<Guid>> ListarIdsVencidosAsync(DateTime ahora, int maximo, CancellationToken ct = default) =>
            db.Pedidos.AsNoTracking()
                .Where(p => p.Estado == EstadoPedido.Pendiente && p.ExpiraEn <= ahora)
                .OrderBy(p => p.ExpiraEn)
                .Select(p => p.Id)
                .Take(maximo)
                .ToListAsync(ct);

        public Task<List<Guid>> ListarIdsPorExpirarSinAvisoAsync(DateTime ahora, DateTime limite,
            CancellationToken ct = default) =>
            db.Pedidos.AsNoTracking()
                .Where(p => p.Estado == EstadoPedido.Pendiente && p.ExpiraEn > ahora && p.ExpiraEn <= limite)
                .Where(p => !db.Notificaciones.Any(n => n.PedidoId == p.Id && n.Tipo == TipoNotificacion.PedidoPorExpirar))
                .Select(p => p.Id)
                .ToListAsync(ct);

        public Task<int> ContarEnCursoDeRepartidorAsync(Guid repartidorId, CancellationToken ct = default) =>
            db.Pedidos.CountAsync(p => p.RepartidorId == repartidorId
                && (p.Estado == EstadoPedido.Asignado || p.Estado == EstadoPedido.EnCamino), ct);

        public void Agregar(Pedido pedido) => db.Pedidos.Add(pedido);
    }
}
