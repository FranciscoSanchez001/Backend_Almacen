using Core.Application.Abstracciones;
using Core.Application.Comun;
using Core.Domain.Enums;
using Presentation.API.Auth;
using Presentation.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Controllers
{
    // Panel del repartidor. Los cambios de estado están en POST /pedidos/{id}/en-camino y /entregado.
    [ApiController]
    [Route("repartidor")]
    [Authorize(Roles = Roles.Repartidor)]
    public class RepartidorController(IPedidoRepository pedidos) : ControllerBase
    {
        // historial=false: sus pedidos por entregar (asignados y en camino).
        // historial=true: sus entregas ya hechas.
        [HttpGet("pedidos")]
        public async Task<Pagina<PedidoResponse>> Pedidos(
            [FromQuery] bool historial = false,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20,
            CancellationToken ct = default)
        {
            var filtro = historial
                ? new FiltroPedidos([EstadoPedido.Entregado], RepartidorId: User.GetUsuarioId(), Orden: OrdenPedidos.PorEntrega)
                : new FiltroPedidos([EstadoPedido.Asignado, EstadoPedido.EnCamino], RepartidorId: User.GetUsuarioId(),
                    Orden: OrdenPedidos.PorAsignacion);
            return (await pedidos.ListarAsync(filtro, pagina, tamano, ct)).Convertir(PedidoResponse.De);
        }
    }
}
