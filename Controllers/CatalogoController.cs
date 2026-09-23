using System.Linq.Expressions;
using Backend_Almacen.Data;
using Backend_Almacen.Dtos;
using Backend_Almacen.Models;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    // Catálogo público de la tienda: solo productos activos con stock disponible.
    [ApiController]
    [Route("catalogo")]
    [AllowAnonymous]
    public class CatalogoController(AlmacenDbContext db, TasaService tasas) : ControllerBase
    {
        private static readonly Expression<Func<Producto, CatalogoItem>> AItem = p => new CatalogoItem(
            p.Id, p.Nombre, p.Descripcion, p.PrecioUsd, null, p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre,
            p.StockDisponible);

        private IQueryable<Producto> Visibles() =>
            db.Productos.AsNoTracking().Where(p => p.Activo && p.StockDisponible > 0);

        [HttpGet]
        public async Task<Pagina<CatalogoItem>> Listar(
            [FromQuery] string? q,
            [FromQuery] int? categoriaId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 24)
        {
            var query = Visibles();
            if (!string.IsNullOrWhiteSpace(q))
            {
                query = query.Where(p => EF.Functions.ILike(p.Nombre, $"%{q.Trim()}%"));
            }
            if (categoriaId is not null)
            {
                query = query.Where(p => p.CategoriaId == categoriaId);
            }

            var resultado = await Pagina<CatalogoItem>.CrearAsync(
                query.OrderBy(p => p.Nombre).ThenBy(p => p.Id).Select(AItem), pagina, tamano);
            var tasa = await tasas.ObtenerActualAsync();
            return resultado.Map(p => p with { PrecioBs = TasaService.EnBs(p.PrecioUsd, tasa) });
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<CatalogoItem>> Obtener(int id)
        {
            var item = await Visibles().Where(p => p.Id == id).Select(AItem).SingleOrDefaultAsync();
            if (item is null)
            {
                return NotFound();
            }
            return item with { PrecioBs = TasaService.EnBs(item.PrecioUsd, await tasas.ObtenerActualAsync()) };
        }
    }
}
