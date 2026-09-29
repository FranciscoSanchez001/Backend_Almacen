using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Presentation.API.Dtos
{
    public record UsuarioResponse(
        Guid Id,
        string Nombre,
        string Email,
        string? Telefono,
        RolUsuario Rol,
        bool Activo,
        DateTime CreadoEn)
    {
        public static UsuarioResponse De(Usuario u) => new(u.Id, u.Nombre, u.Email, u.Telefono, u.Rol, u.Activo, u.CreatedAt);
    }

    // Lo que se guarda en auditoria.datos_antes / datos_despues. Nunca el hash de la contraseña:
    // solo se marca ContrasenaCambiada = true en el "después" cuando se reemplazó.
    public record UsuarioAuditoria(string Nombre, string Email, string? Telefono, RolUsuario Rol, bool Activo,
        bool? ContrasenaCambiada = null)
    {
        public static UsuarioAuditoria De(Usuario u) => new(u.Nombre, u.Email, u.Telefono, u.Rol, u.Activo);
    }
}
