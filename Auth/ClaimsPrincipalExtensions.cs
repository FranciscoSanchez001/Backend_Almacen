using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Backend_Almacen.Auth
{
    public static class ClaimsPrincipalExtensions
    {
        public static int? GetUsuarioIdOrNull(this ClaimsPrincipal user) =>
            int.TryParse(user.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;

        // Para endpoints con [Authorize]: el middleware ya garantizó que el claim existe.
        public static int GetUsuarioId(this ClaimsPrincipal user) =>
            user.GetUsuarioIdOrNull() ?? throw new InvalidOperationException("El token no trae el id del usuario.");
    }
}
