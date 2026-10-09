using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Application.Modelos;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Historial de compras de un cliente (panel de ventas y superadmin).
    [ApiController]
    [Route("clientes")]
    [Authorize(Roles = Roles.Personal)]
    public class ClientesController(IUsuarioRepository usuarios, IPedidoRepository pedidos) : ControllerBase
    {
        // Busca por nombre, email o teléfono (el del perfil o el de cualquiera de sus pedidos).
        [HttpGet]
        public Task<Pagina<ClienteConPedidos>> Buscar(
            [FromQuery] string? buscar,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20,
            CancellationToken ct = default) =>
            usuarios.BuscarClientesAsync(buscar, pagina, tamano, ct);

        [HttpGet("{id:guid}/pedidos")]
        public async Task<ActionResult<Pagina<PedidoResponse>>> Pedidos(
            Guid id,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20,
            CancellationToken ct = default)
        {
            if (!await usuarios.ExisteConRolAsync(id, RolUsuario.Cliente, ct))
            {
                return NotFound();
            }
            return (await pedidos.ListarAsync(new FiltroPedidos(ClienteId: id), pagina, tamano, ct))
                .Convertir(PedidoResponse.De);
        }
    }
}
