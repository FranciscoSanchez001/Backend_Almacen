using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Dtos;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Gestión de usuarios (solo superadmin). Puede ver a todos, pero solo crea, edita, activa y
    // desactiva vendedores y repartidores. Un usuario desactivado pierde el acceso de inmediato
    // (ver OnTokenValidated en Program.cs). Cada cambio queda en la auditoría.
    [ApiController]
    [Route("usuarios")]
    [Authorize(Roles = Roles.Superadmin)]
    public class UsuariosController(
        IUsuarioRepository usuarios,
        IPedidoRepository pedidos,
        IUnitOfWork unidad,
        IHasherContrasenas hasher,
        AuditoriaService auditoria) : ControllerBase
    {
        [HttpGet]
        public async Task<Pagina<UsuarioResponse>> Listar(
            [FromQuery] string? buscar,
            [FromQuery] RolUsuario? rol,
            [FromQuery] bool? activo,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            CancellationToken ct = default) =>
            (await usuarios.ListarAsync(new FiltroUsuarios(buscar, rol, activo), pagina, tamano, ct))
                .Convertir(UsuarioResponse.De);

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<UsuarioResponse>> Obtener(Guid id, CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerAsync(id, ct);
            return usuario is null ? NotFound() : UsuarioResponse.De(usuario);
        }

        [HttpPost]
        public async Task<ActionResult<UsuarioResponse>> Crear(CrearUsuarioRequest req, CancellationToken ct)
        {
            var email = req.Email.Trim().ToLowerInvariant();
            if (await VerificarEmailAsync(email, null, ct) is { } invalido)
            {
                return invalido;
            }

            var usuario = new Usuario
            {
                Id = Guid.CreateVersion7(),
                Nombre = req.Nombre.Trim(),
                Email = email,
                Telefono = Telefonos.NormalizarVenezolano(req.Telefono),
                Rol = req.Rol,
                PasswordHash = hasher.Hash(req.Password),
                CreatedAt = DateTime.UtcNow,
            };
            usuarios.Agregar(usuario);
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Usuario, usuario.Id, AccionAuditoria.Crear,
                null, UsuarioAuditoria.De(usuario));
            await unidad.GuardarCambiosAsync(ct);

            return CreatedAtAction(nameof(Obtener), new { id = usuario.Id }, UsuarioResponse.De(usuario));
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<UsuarioResponse>> Actualizar(Guid id, ActualizarUsuarioRequest req,
            CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerParaEditarAsync(id, ct);
            if (usuario is null)
            {
                return NotFound();
            }
            if (!EsEditable(usuario.Rol))
            {
                return NoEditable();
            }

            var email = req.Email.Trim().ToLowerInvariant();
            if (await VerificarEmailAsync(email, id, ct) is { } invalido)
            {
                return invalido;
            }
            if (usuario.Rol == RolUsuario.Repartidor && req.Rol != RolUsuario.Repartidor
                && await pedidos.ContarEnCursoDeRepartidorAsync(id, ct) > 0)
            {
                return Conflict(new
                {
                    mensaje = "El repartidor tiene pedidos asignados o en camino. Espera a que los entregue antes de cambiarle el rol.",
                });
            }

            var antes = UsuarioAuditoria.De(usuario);
            usuario.Nombre = req.Nombre.Trim();
            usuario.Email = email;
            usuario.Telefono = Telefonos.NormalizarVenezolano(req.Telefono);
            usuario.Rol = req.Rol;
            var despues = UsuarioAuditoria.De(usuario);
            if (!string.IsNullOrEmpty(req.Password))
            {
                usuario.PasswordHash = hasher.Hash(req.Password);
                despues = despues with { ContrasenaCambiada = true };
            }

            if (despues != antes)
            {
                auditoria.Registrar(User.GetUsuarioId(), Entidades.Usuario, id, AccionAuditoria.Editar, antes, despues);
                await unidad.GuardarCambiosAsync(ct);
            }

            return UsuarioResponse.De(usuario);
        }

        [HttpPost("{id:guid}/activar")]
        public Task<ActionResult<UsuarioResponse>> Activar(Guid id, CancellationToken ct) =>
            CambiarActivoAsync(id, true, ct);

        [HttpPost("{id:guid}/desactivar")]
        public Task<ActionResult<UsuarioResponse>> Desactivar(Guid id, CancellationToken ct) =>
            CambiarActivoAsync(id, false, ct);

        private async Task<ActionResult<UsuarioResponse>> CambiarActivoAsync(Guid id, bool activo, CancellationToken ct)
        {
            var usuario = await usuarios.ObtenerParaEditarAsync(id, ct);
            if (usuario is null)
            {
                return NotFound();
            }
            if (!EsEditable(usuario.Rol))
            {
                return NoEditable();
            }
            if (usuario.Activo == activo)
            {
                return UsuarioResponse.De(usuario);
            }
            if (!activo && usuario.Rol == RolUsuario.Repartidor
                && await pedidos.ContarEnCursoDeRepartidorAsync(id, ct) > 0)
            {
                return Conflict(new
                {
                    mensaje = "El repartidor tiene pedidos asignados o en camino. Espera a que los entregue antes de desactivarlo.",
                });
            }

            var antes = UsuarioAuditoria.De(usuario);
            usuario.Activo = activo;
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Usuario, id, AccionAuditoria.Editar,
                antes, UsuarioAuditoria.De(usuario));
            await unidad.GuardarCambiosAsync(ct);

            return UsuarioResponse.De(usuario);
        }

        // El rol y el teléfono ya los validó FluentValidation (Crear/ActualizarUsuarioValidator);
        // aquí solo queda lo que depende de la base de datos.
        private async Task<ActionResult?> VerificarEmailAsync(string email, Guid? usuarioId, CancellationToken ct)
        {
            if (await usuarios.EmailEnUsoAsync(email, usuarioId, ct))
            {
                return Conflict(new { mensaje = $"Ya existe un usuario con el correo {email}." });
            }
            return null;
        }

        private static bool EsEditable(RolUsuario rol) => rol is RolUsuario.Ventas or RolUsuario.Repartidor;

        private ConflictObjectResult NoEditable() =>
            Conflict(new { mensaje = "Desde aquí solo se gestionan vendedores y repartidores." });
    }
}
