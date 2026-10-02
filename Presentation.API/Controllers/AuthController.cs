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
    // (la que usa el frontend). Todos los errores salen como Problem Details (RFC 7807), igual que
    // los del ExceptionMiddleware; además llevan "mensaje" por compatibilidad con el frontend.
    [ApiController]
    [Route("api/auth")]
    [Route("auth")]
    public class AuthController(
        IUsuarioRepository usuarios,
        IRefreshTokenRepository refreshTokens,
        IUnitOfWork unidad,
        IHasherContrasenas hasher,
        TokenService tokens) : ControllerBase
    {
        private const string TipoNoAutenticado = "https://tools.ietf.org/html/rfc9110#section-15.5.2";
        private const string TipoConflicto = "https://tools.ietf.org/html/rfc9110#section-15.5.10";
        private const string TipoNoDisponible = "https://tools.ietf.org/html/rfc9110#section-15.6.4";

        // Los refresh tokens vencidos se conservan un tiempo para poder detectar su reutilización.
        private static readonly TimeSpan RetencionVencidos = TimeSpan.FromDays(30);

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
                return NoAutenticado("Usuario o contraseña incorrectos.");
            }

            return await SesionAsync(usuario, ct);
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
                return Problema(StatusCodes.Status503ServiceUnavailable, "Servicio no disponible", TipoNoDisponible,
                    "El login con Google no está configurado (Google:ClientId).");
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
            }
            catch (InvalidJwtException)
            {
                return NoAutenticado("El token de Google no es válido.");
            }
            if (!payload.EmailVerified)
            {
                return NoAutenticado("El correo de Google no está verificado.");
            }

            var usuario = await usuarios.ObtenerPorGoogleIdParaEditarAsync(payload.Subject, ct);
            if (usuario is null)
            {
                var email = payload.Email.Trim().ToLowerInvariant();
                usuario = await usuarios.ObtenerPorEmailParaEditarAsync(email, ct);
                if (usuario is not null && usuario.Rol != RolUsuario.Cliente)
                {
                    return Problema(StatusCodes.Status409Conflict, "Conflicto con el estado actual", TipoConflicto,
                        "Ese correo pertenece al personal; entra con usuario y contraseña.");
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
                return NoAutenticado("Tu cuenta está desactivada.");
            }

            return await SesionAsync(usuario, ct);
        }

        // Renueva la sesión con rotación: el refresh token recibido se revoca y se emite un par
        // nuevo (JWT + refresh token). Si llega un refresh token ya revocado, alguien lo está
        // reutilizando (posible robo): se cierran todas las sesiones del usuario.
        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponseDto>> Refresh(RefreshTokenDto req, CancellationToken ct)
        {
            var ahora = DateTime.UtcNow;
            var actual = await refreshTokens.ObtenerPorHashParaEditarAsync(
                TokenService.HashRefreshToken(req.RefreshToken), ahora, ct);
            if (actual is null)
            {
                return NoAutenticado("El refresh token no es válido. Inicia sesión de nuevo.");
            }
            if (actual.RevocadoEn is not null)
            {
                await refreshTokens.RevocarTodosDeUsuarioAsync(actual.UsuarioId, ahora, ct);
                return NoAutenticado("El refresh token ya se usó. Por seguridad se cerraron todas tus sesiones.");
            }
            if (!actual.EstaActivo(ahora))
            {
                return NoAutenticado("La sesión venció. Inicia sesión de nuevo.");
            }
            if (!actual.Usuario.Activo)
            {
                await refreshTokens.RevocarTodosDeUsuarioAsync(actual.UsuarioId, ahora, ct);
                return NoAutenticado("Tu cuenta está desactivada.");
            }

            var (valor, nuevo) = tokens.CrearRefreshToken(actual.UsuarioId, ahora);
            if (!await refreshTokens.RevocarSiActivoAsync(actual.Id, ahora, nuevo.Id, ct))
            {
                // Otra petición lo rotó entre la lectura y este UPDATE.
                return NoAutenticado("El refresh token ya se usó. Inicia sesión de nuevo.");
            }
            refreshTokens.Agregar(nuevo);
            await unidad.GuardarCambiosAsync(ct);

            return Respuesta(actual.Usuario, valor, nuevo);
        }

        // Cierra la sesión revocando su refresh token. No exige JWT para poder cerrar sesión aunque
        // el token de acceso ya haya vencido. Responde 204 aunque el token no exista o ya estuviera
        // revocado: el resultado para el cliente es el mismo.
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout(RefreshTokenDto req, CancellationToken ct)
        {
            var ahora = DateTime.UtcNow;
            var token = await refreshTokens.ObtenerPorHashParaEditarAsync(
                TokenService.HashRefreshToken(req.RefreshToken), ahora, ct);
            if (token is not null)
            {
                await refreshTokens.RevocarSiActivoAsync(token.Id, ahora, null, ct);
            }
            return NoContent();
        }

        [HttpGet("yo")]
        [Authorize]
        public async Task<ActionResult<UsuarioSesion>> Yo(CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerAsync(User.GetUsuarioId(), ct);
            return usuario is null ? NotFound() : new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol);
        }

        private async Task<AuthResponseDto> SesionAsync(Usuario usuario, CancellationToken ct)
        {
            var ahora = DateTime.UtcNow;
            await refreshTokens.EliminarVencidosDeUsuarioAsync(usuario.Id, ahora, RetencionVencidos, ct);

            var (valor, refresh) = tokens.CrearRefreshToken(usuario.Id, ahora);
            refreshTokens.Agregar(refresh);
            await unidad.GuardarCambiosAsync(ct);

            return Respuesta(usuario, valor, refresh);
        }

        private AuthResponseDto Respuesta(Usuario usuario, string refreshValor, RefreshToken refresh)
        {
            var (token, expiraEn) = tokens.Crear(usuario);
            return new AuthResponseDto(token, expiraEn, usuario.Nombre, usuario.Email, usuario.Rol,
                new UsuarioSesion(usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol),
                refreshValor, refresh.ExpiraEn);
        }

        private ObjectResult NoAutenticado(string detalle) =>
            Problema(StatusCodes.Status401Unauthorized, "No autenticado", TipoNoAutenticado, detalle);

        private ObjectResult Problema(int status, string titulo, string tipo, string detalle)
        {
            var problema = ProblemDetailsFactory.CreateProblemDetails(HttpContext, status, titulo, tipo, detalle,
                HttpContext.Request.Path);
            problema.Extensions["mensaje"] = detalle;
            return new ObjectResult(problema)
            {
                StatusCode = status,
                ContentTypes = { "application/problem+json" },
            };
        }
    }
}
