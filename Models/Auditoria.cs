namespace Backend_Almacen.Models
{
    public class Auditoria
    {
        public int Id { get; set; }

        public int UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;

        // Nombre de la entidad afectada (producto, pedido, reporte...).
        public required string Entidad { get; set; }
        public int? EntidadId { get; set; }

        public AccionAuditoria Accion { get; set; }

        // JSON (jsonb).
        public string? DatosAntes { get; set; }
        public string? DatosDespues { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
