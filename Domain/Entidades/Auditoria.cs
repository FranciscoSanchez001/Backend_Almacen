using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Domain.Entidades
{
    public class Auditoria
    {
        public Guid Id { get; set; }

        public Guid UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        // Nombre de la entidad afectada (producto, categoria, reporte...).
        public required string Entidad { get; set; }
        public Guid? EntidadId { get; set; }

        public AccionAuditoria Accion { get; set; }

        // JSON (jsonb).
        public string? DatosAntes { get; set; }
        public string? DatosDespues { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
