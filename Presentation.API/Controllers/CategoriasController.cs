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
    [ApiController]
    [Route("categorias")]
    [Authorize(Roles = Roles.Personal)]
    public class CategoriasController(
        ICategoriaRepository categorias,
        IUnitOfWork unidad,
        AuditoriaService auditoria) : ControllerBase
    {
        // Pública: la tienda la usa para el filtro por categorías.
        [HttpGet]
        [AllowAnonymous]
        public async Task<IEnumerable<CategoriaResponse>> Listar(CancellationToken ct) =>
            (await categorias.ListarAsync(ct)).Select(CategoriaResponse.De);

        [HttpPost]
        public async Task<ActionResult<CategoriaResponse>> Crear(CategoriaRequest req, CancellationToken ct)
        {
            var nombre = req.Nombre.Trim();
            if (await categorias.NombreEnUsoAsync(nombre, null, ct))
            {
                return Conflict(new { mensaje = "Ya existe una categoría con ese nombre." });
            }

            var categoria = new Categoria { Id = Guid.CreateVersion7(), Nombre = nombre };
            categorias.Agregar(categoria);
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Categoria, categoria.Id, AccionAuditoria.Crear,
                null, new { categoria.Nombre });
            await unidad.GuardarCambiosAsync(ct);

            return Created($"/categorias/{categoria.Id}", CategoriaResponse.De(categoria));
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<CategoriaResponse>> Actualizar(Guid id, CategoriaRequest req, CancellationToken ct)
        {
            var categoria = await categorias.ObtenerParaEditarAsync(id, ct);
            if (categoria is null)
            {
                return NotFound();
            }

            var nombre = req.Nombre.Trim();
            if (nombre == categoria.Nombre)
            {
                return CategoriaResponse.De(categoria);
            }
            if (await categorias.NombreEnUsoAsync(nombre, id, ct))
            {
                return Conflict(new { mensaje = "Ya existe una categoría con ese nombre." });
            }

            auditoria.Registrar(User.GetUsuarioId(), Entidades.Categoria, id, AccionAuditoria.Editar,
                new { categoria.Nombre }, new { Nombre = nombre });
            categoria.Nombre = nombre;
            await unidad.GuardarCambiosAsync(ct);

            return CategoriaResponse.De(categoria);
        }
    }
}
