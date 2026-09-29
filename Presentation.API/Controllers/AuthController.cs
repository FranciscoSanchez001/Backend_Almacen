using Core.Application.Abstracciones;
using Core.Application.Dtos;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Autenticación stateless con JWT. Responde en /api/auth (ruta de la Fase 3) y en /auth
    // (la que usa el frontend).
    [ApiController]
    [Route("api/auth")]
    [Route("auth")]
    public class AuthController(
        IUsuarioRepository usuarios,
        IUnitOfWork unidad,
        IHasherContrasenas hasher,
        TokenService tokens) : ControllerBase
    {
        // Login del personal (superadmin, ventas, repartidor). Los clientes entran con Google.
        // La contraseña se compara contra el hash bcrypt guardado; con credenciales inválidas la
        // respuesta es la misma exista o no el usuario, para no revelar qué correos están registrados.
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto req, CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerPersonalPorEmailAsync(req.Email, ct);
            if (usuario is null || !usuario.Activo || usuario.PasswordHash is null
                || !hasher.Verificar(req.Password, usuario.PasswordHash))
            {
                return Unauthorized(new { mensaje = "Usuario o contraseña incorrectos." });
            }

            return Sesion(usuario);
        }

        // Login de clientes: el frontend obtiene el ID token con Google Identity Services y lo
        // manda aquí. Si es la primera vez, se crea el cliente.
        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponseDto>> Google(GoogleLoginDto req, [FromServices] IConfiguration config,
            CancellationToken ct)
        {
            var clientId = config["Google:ClientId"];
            if (string.IsNullOrWhiteSpace(clientId))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { mensaje = "El login con Google no está configurado (Google:ClientId)." });
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
            }
            catch (InvalidJwtException)
            {
                return Unauthorized(new { mensaje = "El token de Google no es válido." });
            }
            if (!payload.EmailVerified)
            {
                return Unauthorized(new { mensaje = "El correo de Google no está verificado." });
            }

            var usuario = await usuarios.ObtenerPorGoogleIdParaEditarAsync(payload.Subject, ct);
            if (usuario is null)
            {
                var email = payload.Email.Trim().ToLowerInvariant();
                usuario = await usuarios.ObtenerPorEmailParaEditarAsync(email, ct);
                if (usuario is not null && usuario.Rol != RolUsuario.Cliente)
                {
                    return Conflict(new { mensaje = "Ese correo pertenece al personal; entra con usuario y contraseña." });
                }
                if (usuario is null)
                {
                    usuario = new Usuario
                    {
                        Nombre = string.IsNullOrWhiteSpace(payload.Name) ? email : payload.Name,
                        Email = email,
                        Rol = RolUsuario.Cliente,
                    };
                    usuarios.Agregar(usuario);
                }
                usuario.GoogleId = payload.Subject;
                await unidad.GuardarCambiosAsync(ct);
            }

            if (!usuario.Activo)
            {
                return Unauthorized(new { mensaje = "Tu cuenta está desactivada." });
            }

            return Sesion(usuario);
        }

        [HttpGet("yo")]
        [Authorize]
        public async Task<ActionResult<UsuarioSesion>> Yo(CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerAsync(User.GetUsuarioId(), ct);
            return usuario is null ? NotFound() : new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol);
        }

        private AuthResponseDto Sesion(Usuario usuario)
        {
            var (token, expiraEn) = tokens.Crear(usuario);
            return new AuthResponseDto(token, expiraEn, usuario.Nombre, usuario.Email, usuario.Rol,
                new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol));
        }
    }
}
