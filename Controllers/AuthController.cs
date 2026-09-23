using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Models;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);

    public record GoogleLoginRequest([Required] string IdToken);

    public record UsuarioSesion(int Id, string Nombre, string Email, RolUsuario Rol);

    public record LoginResponse(string Token, DateTime ExpiraEn, UsuarioSesion Usuario);

    [ApiController]
    [Route("auth")]
    public class AuthController(AlmacenDbContext db, TokenService tokens) : ControllerBase
    {
        // Login del personal (superadmin, ventas, repartidor). Los clientes entran con Google.
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
        {
            var email = req.Email.Trim().ToLowerInvariant();
            var usuario = await db.Usuarios.AsNoTracking()
                .SingleOrDefaultAsync(u => u.Email.ToLower() == email && u.Rol != RolUsuario.Cliente);

            if (usuario is null || !usuario.Activo || usuario.PasswordHash is null
                || !BCrypt.Net.BCrypt.Verify(req.Password, usuario.PasswordHash))
            {
                return Unauthorized(new { mensaje = "Usuario o contraseña incorrectos." });
            }

            var (token, expiraEn) = tokens.Crear(usuario);
            return new LoginResponse(token, expiraEn,
                new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol));
        }

        // Login de clientes: el frontend obtiene el ID token con Google Identity Services y lo
        // manda aquí. Si es la primera vez, se crea el cliente.
        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Google(GoogleLoginRequest req, [FromServices] IConfiguration config)
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

            var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.GoogleId == payload.Subject);
            if (usuario is null)
            {
                var email = payload.Email.Trim().ToLowerInvariant();
                usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Email.ToLower() == email);
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
                    db.Usuarios.Add(usuario);
                }
                usuario.GoogleId = payload.Subject;
                await db.SaveChangesAsync();
            }

            if (!usuario.Activo)
            {
                return Unauthorized(new { mensaje = "Tu cuenta está desactivada." });
            }

            var (token, expiraEn) = tokens.Crear(usuario);
            return new LoginResponse(token, expiraEn,
                new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol));
        }

        [HttpGet("yo")]
        [Authorize]
        public async Task<ActionResult<UsuarioSesion>> Yo()
        {
            var id = User.GetUsuarioId();
            var usuario = await db.Usuarios.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new UsuarioSesion(u.Id, u.Nombre, u.Email, u.Rol))
                .SingleOrDefaultAsync();
            return usuario is null ? NotFound() : usuario;
        }
    }
}
