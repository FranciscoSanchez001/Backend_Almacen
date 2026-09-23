using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Dtos;
using Backend_Almacen.Models;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    [ApiController]
    [Route("categorias")]
    [Authorize(Roles = Roles.Personal)]
    public class CategoriasController(AlmacenDbContext db, AuditoriaService auditoria) : ControllerBase
    {
        // Pública: la tienda la usa para el filtro por categorías.
        [HttpGet]
        [AllowAnonymous]
        public async Task<List<Categoria>> Listar() =>
            await db.Categorias.AsNoTracking().OrderBy(c => c.Nombre).ToListAsync();

        [HttpPost]
        public async Task<ActionResult<Categoria>> Crear(CategoriaRequest req)
        {
            var nombre = req.Nombre.Trim();
            if (await NombreEnUsoAsync(nombre, null))
            {
                return Conflict(new { mensaje = "Ya existe una categoría con ese nombre." });
            }

            var categoria = new Categoria { Nombre = nombre };
            await using var tx = await db.Database.BeginTransactionAsync();
            db.Categorias.Add(categoria);
            await db.SaveChangesAsync();
            auditoria.Registrar(User.GetUsuarioId(), Entidades.Categoria, categoria.Id, AccionAuditoria.Crear,
                null, new { categoria.Nombre });
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            return Created($"/categorias/{categoria.Id}", categoria);
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<Categoria>> Actualizar(int id, CategoriaRequest req)
        {
            var categoria = await db.Categorias.FindAsync(id);
            if (categoria is null)
            {
                return NotFound();
            }

            var nombre = req.Nombre.Trim();
            if (nombre == categoria.Nombre)
            {
                return categoria;
            }
            if (await NombreEnUsoAsync(nombre, id))
            {
                return Conflict(new { mensaje = "Ya existe una categoría con ese nombre." });
            }

            auditoria.Registrar(User.GetUsuarioId(), Entidades.Categoria, id, AccionAuditoria.Editar,
                new { categoria.Nombre }, new { Nombre = nombre });
            categoria.Nombre = nombre;
            await db.SaveChangesAsync();

            return categoria;
        }

        private Task<bool> NombreEnUsoAsync(string nombre, int? exceptoId) =>
            db.Categorias.AnyAsync(c => c.Nombre.ToLower() == nombre.ToLower() && c.Id != exceptoId);
    }
}
