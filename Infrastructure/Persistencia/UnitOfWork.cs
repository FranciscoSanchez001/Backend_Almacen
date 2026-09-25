using Core.Application.Abstracciones;
using Core.Application.Comun;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Infrastructure.Persistencia
{
    public class UnitOfWork(ApplicationDbContext db) : IUnitOfWork
    {
        public async Task<ITransaccion> IniciarTransaccionAsync(CancellationToken ct = default) =>
            new Transaccion(await db.Database.BeginTransactionAsync(ct));

        public async Task GuardarCambiosAsync(CancellationToken ct = default) => await db.SaveChangesAsync(ct);

        public bool EnTransaccion => db.Database.CurrentTransaction is not null;

        public void LimpiarSeguimiento() => db.ChangeTracker.Clear();

        private sealed class Transaccion(IDbContextTransaction tx) : ITransaccion
        {
            public Task ConfirmarAsync(CancellationToken ct = default) => tx.CommitAsync(ct);
            public Task RevertirAsync(CancellationToken ct = default) => tx.RollbackAsync(ct);
            public ValueTask DisposeAsync() => tx.DisposeAsync();
        }
    }

    public static class PaginacionExtensions
    {
        // La consulta ya debe venir ordenada.
        public static async Task<Pagina<T>> PaginarAsync<T>(this IQueryable<T> query, int pagina, int tamano,
            CancellationToken ct = default)
        {
            (pagina, tamano) = Pagina<T>.Normalizar(pagina, tamano);
            var total = await query.CountAsync(ct);
            var items = await query.Skip((pagina - 1) * tamano).Take(tamano).ToListAsync(ct);
            return new Pagina<T>(items, total, pagina, tamano);
        }
    }

    public class DiagnosticoBaseDatos(ApplicationDbContext db) : IDiagnosticoBaseDatos
    {
        public Task<bool> PuedeConectarAsync(CancellationToken ct = default) => db.Database.CanConnectAsync(ct);

        public Task<IEnumerable<string>> MigracionesAplicadasAsync(CancellationToken ct = default) =>
            db.Database.GetAppliedMigrationsAsync(ct);

        public Task<IEnumerable<string>> MigracionesPendientesAsync(CancellationToken ct = default) =>
            db.Database.GetPendingMigrationsAsync(ct);
    }
}
