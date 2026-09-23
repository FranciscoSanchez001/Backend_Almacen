using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;
using Backend_Almacen.Domain.Reglas;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
{
    public class UsuarioRepository(ApplicationDbContext db) : IUsuarioRepository
    {
        public Task<Usuario?> ObtenerAsync(Guid id, CancellationToken ct = default) =>
            db.Usuarios.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, ct);

        public Task<Usuario?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default) =>
            db.Usuarios.SingleOrDefaultAsync(u => u.Id == id, ct);

        // Busca por nombre, email o teléfono.
        public Task<Pagina<Usuario>> ListarAsync(FiltroUsuarios filtro, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Usuarios.AsNoTracking();
            if (filtro.Rol is not null)
            {
                query = query.Where(u => u.Rol == filtro.Rol);
            }
            if (filtro.Activo is not null)
            {
                query = query.Where(u => u.Activo == filtro.Activo);
            }
            if (!string.IsNullOrWhiteSpace(filtro.Texto))
            {
                var patron = $"%{filtro.Texto.Trim()}%";
                var telefono = Telefonos.NormalizarVenezolano(filtro.Texto);
                query = query.Where(u => EF.Functions.ILike(u.Nombre, patron)
                    || EF.Functions.ILike(u.Email, patron)
                    || (telefono != null && u.Telefono == telefono));
            }

            return query.OrderBy(u => u.Rol).ThenBy(u => u.Nombre).ThenBy(u => u.Id).PaginarAsync(pagina, tamano, ct);
        }

        public Task<bool> EmailEnUsoAsync(string email, Guid? exceptoId, CancellationToken ct = default)
        {
            var normalizado = email.Trim().ToLowerInvariant();
            return db.Usuarios.AnyAsync(u => u.Email.ToLower() == normalizado && u.Id != exceptoId, ct);
        }

        public Task<Usuario?> ObtenerPersonalPorEmailAsync(string email, CancellationToken ct = default)
        {
            var normalizado = email.Trim().ToLowerInvariant();
            return db.Usuarios.AsNoTracking()
                .SingleOrDefaultAsync(u => u.Email.ToLower() == normalizado && u.Rol != RolUsuario.Cliente, ct);
        }

        public Task<Usuario?> ObtenerPorGoogleIdParaEditarAsync(string googleId, CancellationToken ct = default) =>
            db.Usuarios.SingleOrDefaultAsync(u => u.GoogleId == googleId, ct);

        public Task<Usuario?> ObtenerPorEmailParaEditarAsync(string email, CancellationToken ct = default)
        {
            var normalizado = email.Trim().ToLowerInvariant();
            return db.Usuarios.SingleOrDefaultAsync(u => u.Email.ToLower() == normalizado, ct);
        }

        public Task<bool> ExisteActivoAsync(Guid id, CancellationToken ct = default) =>
            db.Usuarios.AnyAsync(u => u.Id == id && u.Activo, ct);

        public Task<bool> ExisteActivoConRolAsync(Guid id, RolUsuario rol, CancellationToken ct = default) =>
            db.Usuarios.AnyAsync(u => u.Id == id && u.Rol == rol && u.Activo, ct);

        public Task<bool> ExisteConRolAsync(Guid id, RolUsuario rol, CancellationToken ct = default) =>
            db.Usuarios.AnyAsync(u => u.Id == id && u.Rol == rol, ct);

        public Task<bool> ExisteSuperadminAsync(CancellationToken ct = default) =>
            db.Usuarios.AnyAsync(u => u.Rol == RolUsuario.Superadmin, ct);

        public Task AsignarTelefonoSiVacioAsync(Guid id, string telefono, CancellationToken ct = default) =>
            db.Usuarios
                .Where(u => u.Id == id && u.Telefono == null)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.Telefono, telefono), ct);

        public Task<List<RepartidorConCarga>> ListarRepartidoresActivosAsync(CancellationToken ct = default) =>
            db.Usuarios.AsNoTracking()
                .Where(u => u.Rol == RolUsuario.Repartidor && u.Activo)
                .OrderBy(u => u.Nombre)
                .Select(u => new RepartidorConCarga(u.Id, u.Nombre, u.Telefono,
                    db.Pedidos.Count(p => p.RepartidorId == u.Id
                        && (p.Estado == EstadoPedido.Asignado || p.Estado == EstadoPedido.EnCamino))))
                .ToListAsync(ct);

        // Busca por nombre, email o teléfono (el del perfil o el de cualquiera de sus pedidos).
        public Task<Pagina<ClienteConPedidos>> BuscarClientesAsync(string? texto, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Usuarios.AsNoTracking().Where(u => u.Rol == RolUsuario.Cliente);
            if (!string.IsNullOrWhiteSpace(texto))
            {
                var patron = $"%{texto.Trim()}%";
                var telefono = Telefonos.NormalizarVenezolano(texto);
                query = query.Where(u => EF.Functions.ILike(u.Nombre, patron)
                    || EF.Functions.ILike(u.Email, patron)
                    || (telefono != null && (u.Telefono == telefono
                        || db.Pedidos.Any(p => p.ClienteId == u.Id && p.TelefonoContacto == telefono))));
            }

            return query
                .OrderBy(u => u.Nombre).ThenBy(u => u.Id)
                .Select(u => new ClienteConPedidos(u.Id, u.Nombre, u.Email, u.Telefono, u.Activo,
                    db.Pedidos.Count(p => p.ClienteId == u.Id),
                    db.Pedidos.Where(p => p.ClienteId == u.Id).Max(p => (DateTime?)p.CreadoEn)))
                .PaginarAsync(pagina, tamano, ct);
        }

        public void Agregar(Usuario usuario) => db.Usuarios.Add(usuario);
    }
}
