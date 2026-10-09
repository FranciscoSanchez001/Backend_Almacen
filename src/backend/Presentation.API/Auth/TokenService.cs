using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Core.Domain.Entidades;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Presentation.API.Auth
{
    public class JwtOptions
    {
        public required string Issuer { get; set; }
        public required string Audience { get; set; }

        // Clave HS256; mínimo 32 caracteres. En producción va en variables de entorno o user secrets.
        public required string Key { get; set; }
        public int HorasValidez { get; set; } = 8;

        // Vigencia del refresh token; cada renovación emite uno nuevo con esta misma vigencia.
        public int DiasValidezRefresh { get; set; } = 7;

        public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
    }

    public class TokenService(IOptions<JwtOptions> options)
    {
        private readonly JwtOptions jwt = options.Value;

        public (string Token, DateTime ExpiraEn) Crear(Usuario usuario)
        {
            var expiraEn = DateTime.UtcNow.AddHours(jwt.HorasValidez);
            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = jwt.Issuer,
                Audience = jwt.Audience,
                Expires = expiraEn,
                SigningCredentials = new SigningCredentials(jwt.SigningKey(), SecurityAlgorithms.HmacSha256),
                Subject = new ClaimsIdentity(
                [
                    // iat, nbf y exp los agrega JsonWebTokenHandler a partir de Expires.
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                    new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Name, usuario.Nombre),
                    new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
                    new Claim("role", Roles.De(usuario.Rol)),
                ]),
            };

            return (new JsonWebTokenHandler().CreateToken(descriptor), expiraEn);
        }

        // Refresh token opaco: 64 bytes aleatorios en Base64Url. Se devuelve el valor en claro
        // (para el cliente) y la entidad con solo su hash (para la base).
        public (string Valor, RefreshToken Entidad) CrearRefreshToken(Guid usuarioId, DateTime ahora)
        {
            var valor = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
            var entidad = new RefreshToken
            {
                Id = Guid.NewGuid(),
                UsuarioId = usuarioId,
                TokenHash = HashRefreshToken(valor),
                ExpiraEn = ahora.AddDays(jwt.DiasValidezRefresh),
            };
            return (valor, entidad);
        }

        public static string HashRefreshToken(string valor) =>
            Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(valor)));
    }
}
