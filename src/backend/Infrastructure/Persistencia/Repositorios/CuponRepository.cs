using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    public class CuponRepository(ApplicationDbContext db) : ICuponRepository
    {
        public Task<Pagina<Cupon>> ListarAsync(FiltroCupones filtro, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Cupones.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(filtro.Texto))
            {
                var patron = $"%{filtro.Texto.Trim()}%";
                query = query.Where(c => EF.Functions.ILike(c.Codigo, patron)
                    || (c.Descripcion != null && EF.Functions.ILike(c.Descripcion, patron)));
            }
            if (filtro.Activo is not null)
            {
                query = query.Where(c => c.Activo == filtro.Activo);
            }
            return query.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id).PaginarAsync(pagina, tamano, ct);
        }

        public Task<Cupon?> ObtenerAsync(Guid id, CancellationToken ct = default) =>
            db.Cupones.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id, ct);

        public Task<Cupon?> ObtenerPorCodigoAsync(string codigo, CancellationToken ct = default) =>
            db.Cupones.AsNoTracking().SingleOrDefaultAsync(c => c.Codigo == codigo, ct);

        public Task<Cupon?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default) =>
            db.Cupones.SingleOrDefaultAsync(c => c.Id == id, ct);

        public Task<bool> CodigoEnUsoAsync(string codigo, CancellationToken ct = default) =>
            db.Cupones.AnyAsync(c => c.Codigo == codigo, ct);

        // Misma condición que el índice ux_pedidos_cupon_cliente_vigente.
        public Task<bool> ClienteLoUsoAsync(Guid cuponId, Guid clienteId, CancellationToken ct = default) =>
            db.Pedidos.AnyAsync(p => p.CuponId == cuponId && p.ClienteId == clienteId
                && p.Estado != EstadoPedido.Rechazado && p.Estado != EstadoPedido.Expirado, ct);

        public async Task<bool> ConsumirUsoAsync(Guid cuponId, DateTime ahora, CancellationToken ct = default)
        {
            ExigirTransaccion();
            return await db.Database.ExecuteSqlAsync($"""
                UPDATE cupones
                   SET usos_actuales = usos_actuales + 1
                 WHERE id = {cuponId} AND activo
                   AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
                   AND (valido_desde IS NULL OR valido_desde <= {ahora})
                   AND (valido_hasta IS NULL OR valido_hasta > {ahora})
                """, ct) > 0;
        }

        public async Task LiberarUsoAsync(Guid cuponId, CancellationToken ct = default)
        {
            ExigirTransaccion();
            await db.Database.ExecuteSqlAsync(
                $"UPDATE cupones SET usos_actuales = usos_actuales - 1 WHERE id = {cuponId} AND usos_actuales > 0", ct);
        }

        public void Agregar(Cupon cupon) => db.Cupones.Add(cupon);

        private void ExigirTransaccion()
        {
            if (db.Database.CurrentTransaction is null)
            {
                throw new InvalidOperationException("Los usos de un cupón deben cambiarse dentro de una transacción.");
            }
        }
    }
}
