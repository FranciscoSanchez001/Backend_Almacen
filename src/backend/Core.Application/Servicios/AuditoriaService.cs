using System.Text.Json;
using System.Text.Json.Serialization;
using Core.Application.Abstracciones;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Servicios
{
    // Valores de auditoria.entidad.
    public static class Entidades
    {
        public const string Producto = "producto";
        public const string Categoria = "categoria";
        public const string Usuario = "usuario";
        public const string Zona = "zona";
        public const string Reporte = "reporte";
        public const string Configuracion = "configuracion";
    }

    public class AuditoriaService(IAuditoriaRepository auditoria)
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        };

        // Solo agrega la fila: se guarda con el GuardarCambiosAsync del llamador, dentro de la
        // misma transacción que el cambio auditado.
        public void Registrar(Guid usuarioId, string entidad, Guid? entidadId, AccionAuditoria accion,
            object? antes, object? despues)
        {
            auditoria.Agregar(new Auditoria
            {
                UsuarioId = usuarioId,
                Entidad = entidad,
                EntidadId = entidadId,
                Accion = accion,
                DatosAntes = antes is null ? null : JsonSerializer.Serialize(antes, Json),
                DatosDespues = despues is null ? null : JsonSerializer.Serialize(despues, Json),
            });
        }
    }
}
