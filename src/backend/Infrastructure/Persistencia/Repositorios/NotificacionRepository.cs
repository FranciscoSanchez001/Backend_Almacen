using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    public class NotificacionRepository(ApplicationDbContext db) : INotificacionRepository
    {
        public Task<Pagina<Notificacion>> ListarAsync(bool soloNoLeidas, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Notificaciones.AsNoTracking().Include(n => n.Producto).AsQueryable();
            if (soloNoLeidas)
            {
                query = query.Where(n => !n.Leida);
            }
            return query.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).PaginarAsync(pagina, tamano, ct);
        }

        public async Task<bool> MarcarLeidaAsync(Guid id, CancellationToken ct = default) =>
            await db.Notificaciones
                .Where(n => n.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true), ct) > 0;

        public Task MarcarTodasLeidasAsync(CancellationToken ct = default) =>
            db.Notificaciones
                .Where(n => !n.Leida)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true), ct);

        // Si el producto vuelve a tener stock, el aviso de agotado ya no aplica.
        public Task MarcarAgotadoResueltoAsync(Guid productoId, CancellationToken ct = default) =>
            db.Notificaciones
                .Where(n => n.ProductoId == productoId && n.Tipo == TipoNotificacion.StockAgotado && !n.Leida)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true), ct);

        public void Agregar(Notificacion notificacion) => db.Notificaciones.Add(notificacion);
    }
}
