using System.Security.Claims;
using System.Text;
using Backend_Almacen.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Backend_Almacen.Auth
{
    public class JwtOptions
    {
        public required string Issuer { get; set; }
        public required string Audience { get; set; }

        // Clave HS256; mínimo 32 caracteres. En producción va en variables de entorno o user secrets.
        public required string Key { get; set; }
        public int HorasValidez { get; set; } = 8;

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
                    new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Name, usuario.Nombre),
                    new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
                    new Claim("role", Roles.De(usuario.Rol)),
                ]),
            };

            return (new JsonWebTokenHandler().CreateToken(descriptor), expiraEn);
        }
    }
}
