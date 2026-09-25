using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    public class Auditoria : BaseEntity
    {
        public Guid UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        // Nombre de la entidad afectada (producto, categoria, reporte...).
        public required string Entidad { get; set; }
        public Guid? EntidadId { get; set; }

        public AccionAuditoria Accion { get; set; }

        // JSON (jsonb).
        public string? DatosAntes { get; set; }
        public string? DatosDespues { get; set; }

    }
}
