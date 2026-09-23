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
    // Historial de compras de un cliente (panel de ventas y superadmin).
    [ApiController]
    [Route("clientes")]
    [Authorize(Roles = Roles.Personal)]
    public class ClientesController(AlmacenDbContext db, PedidosService pedidos) : ControllerBase
    {
        // Busca por nombre, email o teléfono (el del perfil o el de cualquiera de sus pedidos).
        [HttpGet]
        public async Task<Pagina<ClienteListado>> Buscar(
            [FromQuery] string? buscar,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20)
        {
            var query = db.Usuarios.AsNoTracking().Where(u => u.Rol == RolUsuario.Cliente);
            if (!string.IsNullOrWhiteSpace(buscar))
            {
                var patron = $"%{buscar.Trim()}%";
                var telefono = Telefonos.NormalizarVenezolano(buscar);
                query = query.Where(u => EF.Functions.ILike(u.Nombre, patron)
                    || EF.Functions.ILike(u.Email, patron)
                    || (telefono != null && (u.Telefono == telefono
                        || db.Pedidos.Any(p => p.ClienteId == u.Id && p.TelefonoContacto == telefono))));
            }

            return await Pagina<ClienteListado>.CrearAsync(
                query.OrderBy(u => u.Nombre).ThenBy(u => u.Id)
                    .Select(u => new ClienteListado(u.Id, u.Nombre, u.Email, u.Telefono, u.Activo,
                        db.Pedidos.Count(p => p.ClienteId == u.Id),
                        db.Pedidos.Where(p => p.ClienteId == u.Id).Max(p => (DateTime?)p.CreadoEn))),
                pagina, tamano);
        }

        [HttpGet("{id:int}/pedidos")]
        public async Task<ActionResult<Pagina<PedidoResponse>>> Pedidos(
            int id,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20)
        {
            if (!await db.Usuarios.AnyAsync(u => u.Id == id && u.Rol == RolUsuario.Cliente))
            {
                return NotFound();
            }

            var query = pedidos.ConDetalle()
                .Where(p => p.ClienteId == id)
                .OrderByDescending(p => p.CreadoEn).ThenByDescending(p => p.Id);
            return (await Pagina<Pedido>.CrearAsync(query, pagina, tamano)).Convertir(PedidoResponse.De);
        }
    }
}
