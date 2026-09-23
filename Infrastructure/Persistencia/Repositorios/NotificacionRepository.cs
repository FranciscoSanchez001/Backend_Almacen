using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
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
            return query.OrderByDescending(n => n.CreadoEn).ThenByDescending(n => n.Id).PaginarAsync(pagina, tamano, ct);
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
