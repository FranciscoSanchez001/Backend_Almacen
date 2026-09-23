using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.WebAPI.Dtos
{
    // Rol: solo ventas o repartidor (el superadmin no crea otros superadmin ni clientes).
    public record CrearUsuarioRequest(
        [Required, StringLength(150, MinimumLength = 1)] string Nombre,
        [Required, EmailAddress, StringLength(254)] string Email,
        [StringLength(20)] string? Telefono,
        RolUsuario Rol,
        [Required, StringLength(72, MinimumLength = 8)] string Password);

    // Password es opcional: si viene, reemplaza la contraseña actual.
    public record ActualizarUsuarioRequest(
        [Required, StringLength(150, MinimumLength = 1)] string Nombre,
        [Required, EmailAddress, StringLength(254)] string Email,
        [StringLength(20)] string? Telefono,
        RolUsuario Rol,
        [StringLength(72, MinimumLength = 8)] string? Password);

    public record UsuarioResponse(
        Guid Id,
        string Nombre,
        string Email,
        string? Telefono,
        RolUsuario Rol,
        bool Activo,
        DateTime CreadoEn)
    {
        public static UsuarioResponse De(Usuario u) => new(u.Id, u.Nombre, u.Email, u.Telefono, u.Rol, u.Activo, u.CreadoEn);
    }

    // Lo que se guarda en auditoria.datos_antes / datos_despues. Nunca el hash de la contraseña:
    // solo se marca ContrasenaCambiada = true en el "después" cuando se reemplazó.
    public record UsuarioAuditoria(string Nombre, string Email, string? Telefono, RolUsuario Rol, bool Activo,
        bool? ContrasenaCambiada = null)
    {
        public static UsuarioAuditoria De(Usuario u) => new(u.Nombre, u.Email, u.Telefono, u.Rol, u.Activo);
    }
}
