using Core.Application.Abstracciones;
using Core.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistencia.Repositorios
{
    public class RefreshTokenRepository(ApplicationDbContext db) : IRefreshTokenRepository
    {
        public async Task<RefreshToken?> ObtenerPorHashParaEditarAsync(string tokenHash, DateTime ahora,
            CancellationToken ct = default)
        {
            var token = await db.RefreshTokens.SingleOrDefaultAsync(r => r.TokenHash == tokenHash, ct);

            // Carga explícita en vez de Include: el usuario solo hace falta si el token sirve para
            // renovar la sesión. Con uno revocado o vencido basta UsuarioId y se ahorra el JOIN.
            if (token is not null && token.EstaActivo(ahora))
            {
                await db.Entry(token).Reference(r => r.Usuario).LoadAsync(ct);
            }
            return token;
        }

        public async Task<bool> RevocarSiActivoAsync(Guid id, DateTime ahora, Guid? reemplazadoPorId,
            CancellationToken ct = default) =>
            await db.RefreshTokens
                .Where(r => r.Id == id && r.RevocadoEn == null && r.ExpiraEn > ahora)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.RevocadoEn, ahora)
                    .SetProperty(r => r.ReemplazadoPorId, reemplazadoPorId), ct) > 0;

        public Task RevocarTodosDeUsuarioAsync(Guid usuarioId, DateTime ahora, CancellationToken ct = default) =>
            db.RefreshTokens
                .Where(r => r.UsuarioId == usuarioId && r.RevocadoEn == null)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.RevocadoEn, ahora), ct);

        public Task EliminarVencidosDeUsuarioAsync(Guid usuarioId, DateTime ahora, TimeSpan margen,
            CancellationToken ct = default)
        {
            var limite = ahora - margen;
            return db.RefreshTokens
                .Where(r => r.UsuarioId == usuarioId && r.ExpiraEn < limite)
                .ExecuteDeleteAsync(ct);
        }

        public void Agregar(RefreshToken token) => db.RefreshTokens.Add(token);
    }
}
