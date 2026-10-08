using Core.Application.Abstracciones;

namespace Infrastructure.Seguridad
{
    public class HasherBcrypt : IHasherContrasenas
    {
        public string Hash(string contrasena) => BCrypt.Net.BCrypt.HashPassword(contrasena);

        public bool Verificar(string contrasena, string hash) => BCrypt.Net.BCrypt.Verify(contrasena, hash);
    }
}
