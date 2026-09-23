using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Infrastructure.Persistencia.Repositorios
{
    public class CategoriaRepository(ApplicationDbContext db) : ICategoriaRepository
    {
        public Task<List<Categoria>> ListarAsync(CancellationToken ct = default) =>
            db.Categorias.AsNoTracking().OrderBy(c => c.Nombre).ToListAsync(ct);

        public Task<bool> ExisteAsync(Guid id, CancellationToken ct = default) =>
            db.Categorias.AnyAsync(c => c.Id == id, ct);

        public Task<bool> NombreEnUsoAsync(string nombre, Guid? exceptoId, CancellationToken ct = default)
        {
            var normalizado = nombre.Trim().ToLower();
            return db.Categorias.AnyAsync(c => c.Nombre.ToLower() == normalizado && c.Id != exceptoId, ct);
        }

        public Task<Categoria?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default) =>
            db.Categorias.SingleOrDefaultAsync(c => c.Id == id, ct);

        public void Agregar(Categoria categoria) => db.Categorias.Add(categoria);
    }

    public class ZonaRepository(ApplicationDbContext db) : IZonaRepository
    {
        public Task<List<Zona>> ListarActivasAsync(CancellationToken ct = default) =>
            db.Zonas.AsNoTracking().Where(z => z.Activa).OrderBy(z => z.Nombre).ToListAsync(ct);

        public Task<List<Zona>> ListarTodasAsync(CancellationToken ct = default) =>
            db.Zonas.AsNoTracking().OrderBy(z => z.Nombre).ToListAsync(ct);

        public Task<bool> ExisteActivaAsync(Guid id, CancellationToken ct = default) =>
            db.Zonas.AnyAsync(z => z.Id == id && z.Activa, ct);

        public Task<bool> NombreEnUsoAsync(string nombre, Guid? exceptoId, CancellationToken ct = default)
        {
            var normalizado = nombre.Trim().ToLower();
            return db.Zonas.AnyAsync(z => z.Nombre.ToLower() == normalizado && z.Id != exceptoId, ct);
        }

        public Task<Zona?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default) =>
            db.Zonas.SingleOrDefaultAsync(z => z.Id == id, ct);

        public void Agregar(Zona zona) => db.Zonas.Add(zona);
    }

    public class ConfiguracionRepository(ApplicationDbContext db) : IConfiguracionRepository
    {
        public Task<Configuracion> ObtenerAsync(CancellationToken ct = default) =>
            db.Configuracion.AsNoTracking().SingleAsync(c => c.Id == Configuracion.IdUnico, ct);

        public Task<Configuracion> ObtenerParaEditarAsync(CancellationToken ct = default) =>
            db.Configuracion.SingleAsync(c => c.Id == Configuracion.IdUnico, ct);

        public Task<Pagina<HistorialTasa>> ListarTasasAsync(int pagina, int tamano, CancellationToken ct = default) =>
            db.HistorialTasas.AsNoTracking()
                .Include(h => h.Usuario)
                .OrderByDescending(h => h.CreadoEn).ThenByDescending(h => h.Id)
                .PaginarAsync(pagina, tamano, ct);

        public void AgregarTasa(HistorialTasa tasa) => db.HistorialTasas.Add(tasa);
    }

    public class AuditoriaRepository(ApplicationDbContext db) : IAuditoriaRepository
    {
        public void Agregar(Auditoria auditoria) => db.Auditoria.Add(auditoria);

        public Task<Pagina<RegistroAuditoria>> ListarAsync(FiltroAuditoria filtro, int pagina, int tamano,
            CancellationToken ct = default)
        {
            var query = db.Auditoria.AsNoTracking();
            if (filtro.UsuarioId is not null)
            {
                query = query.Where(a => a.UsuarioId == filtro.UsuarioId);
            }
            if (!string.IsNullOrWhiteSpace(filtro.Entidad))
            {
                var entidad = filtro.Entidad.Trim().ToLowerInvariant();
                query = query.Where(a => a.Entidad == entidad);
            }
            if (filtro.EntidadId is not null)
            {
                query = query.Where(a => a.EntidadId == filtro.EntidadId);
            }
            if (filtro.Desde is not null)
            {
                query = query.Where(a => a.CreadoEn >= filtro.Desde);
            }
            if (filtro.Hasta is not null)
            {
                query = query.Where(a => a.CreadoEn < filtro.Hasta);
            }

            return query
                .OrderByDescending(a => a.CreadoEn).ThenByDescending(a => a.Id)
                .Select(a => new RegistroAuditoria(
                    a.Id,
                    a.UsuarioId,
                    a.Usuario.Nombre,
                    a.Entidad,
                    a.EntidadId,
                    a.Entidad == Entidades.Producto ? db.Productos.Where(p => p.Id == a.EntidadId).Select(p => p.Nombre).FirstOrDefault()
                    : a.Entidad == Entidades.Categoria ? db.Categorias.Where(c => c.Id == a.EntidadId).Select(c => c.Nombre).FirstOrDefault()
                    : a.Entidad == Entidades.Zona ? db.Zonas.Where(z => z.Id == a.EntidadId).Select(z => z.Nombre).FirstOrDefault()
                    : a.Entidad == Entidades.Usuario ? db.Usuarios.Where(u => u.Id == a.EntidadId).Select(u => u.Nombre).FirstOrDefault()
                    : null,
                    a.Accion,
                    a.DatosAntes,
                    a.DatosDespues,
                    a.CreadoEn))
                .PaginarAsync(pagina, tamano, ct);
        }

        public Task<Pagina<CambioEstadoPedido>> ListarCambiosEstadoAsync(FiltroCambiosEstado filtro, int pagina,
            int tamano, CancellationToken ct = default)
        {
            var query = db.HistorialEstadosPedido.AsNoTracking();
            if (filtro.UsuarioId is not null)
            {
                query = query.Where(h => h.UsuarioId == filtro.UsuarioId);
            }
            if (filtro.PedidoId is not null)
            {
                query = query.Where(h => h.PedidoId == filtro.PedidoId);
            }
            if (filtro.Desde is not null)
            {
                query = query.Where(h => h.CreadoEn >= filtro.Desde);
            }
            if (filtro.Hasta is not null)
            {
                query = query.Where(h => h.CreadoEn < filtro.Hasta);
            }

            return query
                // "aprobado" y "asignado" se registran en el mismo instante: el desempate por estado
                // (el enum sigue el orden del flujo) los deja en orden, como en PedidoResponse.
                .OrderByDescending(h => h.CreadoEn).ThenByDescending(h => h.EstadoNuevo).ThenByDescending(h => h.Id)
                .Select(h => new CambioEstadoPedido(
                    h.Id,
                    h.PedidoId,
                    h.Pedido.Numero,
                    h.EstadoAnterior,
                    h.EstadoNuevo,
                    h.UsuarioId,
                    h.Usuario != null ? h.Usuario.Nombre : null,
                    h.CreadoEn))
                .PaginarAsync(pagina, tamano, ct);
        }
    }

    public class MensajeWhatsappRepository(ApplicationDbContext db) : IMensajeWhatsappRepository
    {
        public void Agregar(MensajeWhatsapp mensaje) => db.MensajesWhatsapp.Add(mensaje);
    }
}
