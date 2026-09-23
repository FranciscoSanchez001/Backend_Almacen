using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.WebAPI.Dtos
{
    public record CrearZonaRequest([Required, StringLength(100, MinimumLength = 1)] string Nombre);

    public record ActualizarZonaRequest([Required, StringLength(100, MinimumLength = 1)] string Nombre, bool Activa);

    public record ZonaAdminResponse(Guid Id, string Nombre, bool Activa)
    {
        public static ZonaAdminResponse De(Zona z) => new(z.Id, z.Nombre, z.Activa);
    }

    // DatosAntes / DatosDespues van como objetos JSON, no como texto.
    public record AuditoriaResponse(
        Guid Id,
        Guid UsuarioId,
        string Usuario,
        string Entidad,
        Guid? EntidadId,
        string? EntidadNombre,
        AccionAuditoria Accion,
        JsonElement? DatosAntes,
        JsonElement? DatosDespues,
        DateTime CreadoEn)
    {
        public static AuditoriaResponse De(RegistroAuditoria r) => new(
            r.Id, r.UsuarioId, r.Usuario, r.Entidad, r.EntidadId, r.EntidadNombre, r.Accion,
            Json(r.DatosAntes), Json(r.DatosDespues), r.CreadoEn);

        private static JsonElement? Json(string? texto)
        {
            if (texto is null)
            {
                return null;
            }
            using var doc = JsonDocument.Parse(texto);
            return doc.RootElement.Clone();
        }
    }
}
