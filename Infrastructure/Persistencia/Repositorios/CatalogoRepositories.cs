using Backend_Almacen.Application.Abstracciones;
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

        public Task<bool> ExisteActivaAsync(Guid id, CancellationToken ct = default) =>
            db.Zonas.AnyAsync(z => z.Id == id && z.Activa, ct);
    }

    public class ConfiguracionRepository(ApplicationDbContext db) : IConfiguracionRepository
    {
        public Task<Configuracion> ObtenerAsync(CancellationToken ct = default) =>
            db.Configuracion.AsNoTracking().SingleAsync(c => c.Id == Configuracion.IdUnico, ct);
    }

    public class AuditoriaRepository(ApplicationDbContext db) : IAuditoriaRepository
    {
        public void Agregar(Auditoria auditoria) => db.Auditoria.Add(auditoria);
    }

    public class MensajeWhatsappRepository(ApplicationDbContext db) : IMensajeWhatsappRepository
    {
        public void Agregar(MensajeWhatsapp mensaje) => db.MensajesWhatsapp.Add(mensaje);
    }
}
