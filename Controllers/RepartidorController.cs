using Backend_Almacen.Auth;
using Backend_Almacen.Dtos;
using Backend_Almacen.Models;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend_Almacen.Controllers
{
    // Panel del repartidor. Los cambios de estado están en POST /pedidos/{id}/en-camino y /entregado.
    [ApiController]
    [Route("repartidor")]
    [Authorize(Roles = Roles.Repartidor)]
    public class RepartidorController(PedidosService pedidos) : ControllerBase
    {
        // historial=false: sus pedidos por entregar (asignados y en camino).
        // historial=true: sus entregas ya hechas.
        [HttpGet("pedidos")]
        public async Task<Pagina<PedidoResponse>> Pedidos(
            [FromQuery] bool historial = false,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20)
        {
            var repartidorId = User.GetUsuarioId();
            var query = pedidos.ConDetalle().Where(p => p.RepartidorId == repartidorId);

            var ordenada = historial
                ? query.Where(p => p.Estado == EstadoPedido.Entregado)
                    .OrderByDescending(p => p.EntregadoEn).ThenByDescending(p => p.Id)
                : query.Where(p => p.Estado == EstadoPedido.Asignado || p.Estado == EstadoPedido.EnCamino)
                    .OrderBy(p => p.AsignadoEn).ThenBy(p => p.Id);

            return (await Pagina<Pedido>.CrearAsync(ordenada, pagina, tamano)).Convertir(PedidoResponse.De);
        }
    }
}
