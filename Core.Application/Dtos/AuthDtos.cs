using Core.Domain.Enums;

namespace Core.Application.Dtos
{
    // POST /api/auth/login. El personal se identifica con su correo, que es su nombre de usuario.
    public record LoginDto(string Email, string Password);

    public record GoogleLoginDto(string IdToken);

    public record UsuarioSesion(Guid Id, string Nombre, string Email, RolUsuario Rol);

    // Token JWT firmado (HMAC-SHA256) más los datos del usuario. Username, Email y Rol van también
    // en la raíz para que el cliente no tenga que decodificar el token; Usuario se mantiene por
    // compatibilidad con el frontend.
    public record AuthResponseDto(
        string Token,
        DateTime ExpiraEn,
        string Username,
        string Email,
        RolUsuario Rol,
        UsuarioSesion Usuario);
}
