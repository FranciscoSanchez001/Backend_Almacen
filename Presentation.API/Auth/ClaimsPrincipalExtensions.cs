using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Presentation.API.Auth
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid? GetUsuarioIdOrNull(this ClaimsPrincipal user) =>
            Guid.TryParse(user.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;

        // Para endpoints con [Authorize]: el middleware ya garantizó que el claim existe.
        public static Guid GetUsuarioId(this ClaimsPrincipal user) =>
            user.GetUsuarioIdOrNull() ?? throw new InvalidOperationException("El token no trae el id del usuario.");
    }
}
