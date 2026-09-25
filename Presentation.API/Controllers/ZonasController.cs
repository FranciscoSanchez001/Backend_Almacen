using Core.Application.Abstracciones;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Zonas de entrega (solo superadmin). No se borran porque los pedidos las referencian: se
    // desactivan y dejan de aparecer en el checkout (GET /catalogo/zonas), pero los pedidos que ya
    // las usan conservan su zona.
    [ApiController]
    [Route("zonas")]
    [Authorize(Roles = Roles.Superadmin)]
    public class ZonasController(
        IZonaRepository zonas,
        IUnitOfWork unidad,
        AuditoriaService auditoria) : ControllerBase
    {
        // Todas, activas e inactivas.
        [HttpGet]
        public async Task<IEnumerable<ZonaAdminResponse>> Listar(CancellationToken ct) =>
            (await zonas.ListarTodasAsync(ct)).Select(ZonaAdminResponse.De);

        [HttpPost]
        public async Task<ActionResult<ZonaAdminResponse>> Crear(CrearZonaRequest req, CancellationToken ct)
        {
            var nombre = req.Nombre.Trim();
            if (await zonas.NombreEnUsoAsync(nombre, null, ct))
            {
                return Conflict(new { mensaje = "Ya existe una zona con ese nombre." });
            }

            var zona = new Zona { Id = Guid.CreateVersion7(), Nombre = nombre };
            zonas.Agregar(zona);
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Zona, zona.Id, AccionAuditoria.Crear,
                null, new { zona.Nombre, zona.Activa });
            await unidad.GuardarCambiosAsync(ct);

            return Created($"/zonas/{zona.Id}", ZonaAdminResponse.De(zona));
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ZonaAdminResponse>> Actualizar(Guid id, ActualizarZonaRequest req,
            CancellationToken ct)
        {
            var zona = await zonas.ObtenerParaEditarAsync(id, ct);
            if (zona is null)
            {
                return NotFound();
            }

            var nombre = req.Nombre.Trim();
            if (nombre == zona.Nombre && req.Activa == zona.Activa)
            {
                return ZonaAdminResponse.De(zona);
            }
            if (nombre != zona.Nombre && await zonas.NombreEnUsoAsync(nombre, id, ct))
            {
                return Conflict(new { mensaje = "Ya existe una zona con ese nombre." });
            }

            auditoria.Registrar(User.GetUsuarioId(), Entidades.Zona, id, AccionAuditoria.Editar,
                new { zona.Nombre, zona.Activa }, new { Nombre = nombre, req.Activa });
            zona.Nombre = nombre;
            zona.Activa = req.Activa;
            await unidad.GuardarCambiosAsync(ct);

            return ZonaAdminResponse.De(zona);
        }
    }
}
