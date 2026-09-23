using System.Text.Json;
using System.Text.Json.Serialization;
using Backend_Almacen.Data;
using Backend_Almacen.Models;

namespace Backend_Almacen.Services
{
    // Valores de auditoria.entidad.
    public static class Entidades
    {
        public const string Producto = "producto";
        public const string Categoria = "categoria";
    }

    public class AuditoriaService(AlmacenDbContext db)
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        };

        // Solo agrega la fila al contexto: se guarda con el SaveChangesAsync del llamador,
        // dentro de la misma transacción que el cambio auditado.
        public void Registrar(int usuarioId, string entidad, int? entidadId, AccionAuditoria accion,
            object? antes, object? despues)
        {
            db.Auditoria.Add(new Auditoria
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
