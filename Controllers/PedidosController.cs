using System.Text.Json;
using Backend_Almacen.Auth;
using Backend_Almacen.Data;
using Backend_Almacen.Dtos;
using Backend_Almacen.Models;
using Backend_Almacen.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Controllers
{
    [ApiController]
    [Route("pedidos")]
    [Authorize]
    public class PedidosController(AlmacenDbContext db, PedidosService pedidos) : ControllerBase
    {
        private const long TamanoMaximoCaptura = 5 * 1024 * 1024;
        private static readonly string[] TiposCaptura = ["image/jpeg", "image/png", "image/webp"];

        // ---- Cliente ----

        [HttpPost]
        [Authorize(Roles = Roles.Cliente)]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(TamanoMaximoCaptura + 1024 * 1024)]
        public async Task<ActionResult<PedidoResponse>> Crear([FromForm] CrearPedidoForm form, CancellationToken ct)
        {
            var metodo = form.MetodoPago.Trim().ToLowerInvariant() switch
            {
                "transferencia" => MetodoPago.Transferencia,
                "pago_movil" => MetodoPago.PagoMovil,
                "binance" => MetodoPago.Binance,
                _ => (MetodoPago?)null,
            };
            if (metodo is null)
            {
                ModelState.AddModelError(nameof(form.MetodoPago), "Debe ser transferencia, pago_movil o binance.");
            }

            var telefono = Telefonos.NormalizarVenezolano(form.Telefono);
            if (telefono is null)
            {
                ModelState.AddModelError(nameof(form.Telefono), "Debe ser un celular venezolano: +58 4XX XXX XXXX.");
            }

            var captura = form.Captura!;
            if (captura.Length == 0 || captura.Length > TamanoMaximoCaptura)
            {
                ModelState.AddModelError(nameof(form.Captura), "La captura debe pesar como máximo 5 MB.");
            }
            if (!TiposCaptura.Contains(captura.ContentType.ToLowerInvariant()))
            {
                ModelState.AddModelError(nameof(form.Captura), "La captura debe ser una imagen JPG, PNG o WEBP.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            var resultado = await pedidos.CrearAsync(User.GetUsuarioId(), new NuevoPedido(
                form.Items.Select(i => (i.ProductoId, i.Cantidad)).ToList(),
                metodo!.Value,
                form.ReferenciaPago,
                form.ZonaId,
                form.DireccionTexto,
                form.Latitud,
                form.Longitud,
                telefono!), captura, ct);

            if (resultado.Error is not null)
            {
                return Error(resultado);
            }
            var pedido = await pedidos.ObtenerAsync(resultado.PedidoId!.Value);
            return CreatedAtAction(nameof(Obtener), new { id = pedido!.Id }, PedidoResponse.De(pedido));
        }

        // Mis pedidos: estado de cada uno e historial completo.
        [HttpGet("mios")]
        [Authorize(Roles = Roles.Cliente)]
        public async Task<Pagina<PedidoResponse>> Mios([FromQuery] int pagina = 1, [FromQuery] int tamano = 20)
        {
            var clienteId = User.GetUsuarioId();
            var query = pedidos.ConDetalle()
                .Where(p => p.ClienteId == clienteId)
                .OrderByDescending(p => p.CreadoEn).ThenByDescending(p => p.Id);
            return (await Pagina<Pedido>.CrearAsync(query, pagina, tamano)).Convertir(PedidoResponse.De);
        }

        // ---- Panel de ventas / superadmin ----

        // Bandeja: con estado=pendiente salen primero los que están más cerca de vencer.
        [HttpGet]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<Pagina<PedidoResponse>>> Listar(
            [FromQuery(Name = "estado")] string? estadoTexto,
            [FromQuery] int? zonaId,
            [FromQuery] int? repartidorId,
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20)
        {
            // Mismos nombres que en el JSON: pendiente, asignado, en_camino...
            EstadoPedido? estado = null;
            if (!string.IsNullOrWhiteSpace(estadoTexto))
            {
                estado = Enum.GetValues<EstadoPedido>().Cast<EstadoPedido?>().FirstOrDefault(e =>
                    JsonNamingPolicy.SnakeCaseLower.ConvertName(e.ToString()!) == estadoTexto.Trim().ToLowerInvariant());
                if (estado is null)
                {
                    return BadRequest(new { mensaje = $"Estado desconocido: {estadoTexto}." });
                }
            }

            var query = pedidos.ConDetalle();
            if (estado is not null)
            {
                query = query.Where(p => p.Estado == estado);
            }
            if (zonaId is not null)
            {
                query = query.Where(p => p.ZonaId == zonaId);
            }
            if (repartidorId is not null)
            {
                query = query.Where(p => p.RepartidorId == repartidorId);
            }
            if (desde is not null)
            {
                var d = DateTime.SpecifyKind(desde.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn >= d);
            }
            if (hasta is not null)
            {
                var h = DateTime.SpecifyKind(hasta.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn < h);
            }

            var ordenada = estado == EstadoPedido.Pendiente
                ? query.OrderBy(p => p.ExpiraEn).ThenBy(p => p.Id)
                : query.OrderByDescending(p => p.CreadoEn).ThenByDescending(p => p.Id);
            return (await Pagina<Pedido>.CrearAsync(ordenada, pagina, tamano)).Convertir(PedidoResponse.De);
        }

        // Para el selector de "Aprobar": repartidores activos y cuántos pedidos llevan en curso.
        [HttpGet("repartidores")]
        [Authorize(Roles = Roles.Personal)]
        public async Task<List<RepartidorDisponible>> Repartidores() =>
            await db.Usuarios.AsNoTracking()
                .Where(u => u.Rol == RolUsuario.Repartidor && u.Activo)
                .OrderBy(u => u.Nombre)
                .Select(u => new RepartidorDisponible(u.Id, u.Nombre, u.Telefono,
                    db.Pedidos.Count(p => p.RepartidorId == u.Id
                        && (p.Estado == EstadoPedido.Asignado || p.Estado == EstadoPedido.EnCamino))))
                .ToListAsync();

        [HttpPost("{id:int}/aprobar")]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<PedidoResponse>> Aprobar(int id, AprobarPedidoRequest req) =>
            await Responder(await pedidos.AprobarAsync(id, req.RepartidorId, User.GetUsuarioId()));

        [HttpPost("{id:int}/rechazar")]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<PedidoResponse>> Rechazar(int id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RechazarPedidoRequest? req) =>
            await Responder(await pedidos.RechazarAsync(id, req?.Motivo, User.GetUsuarioId()));

        // ---- Repartidor (solo sus pedidos) / superadmin ----

        [HttpPost("{id:int}/en-camino")]
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Superadmin)]
        public async Task<ActionResult<PedidoResponse>> EnCamino(int id) =>
            await Responder(await pedidos.AvanzarEntregaAsync(id, EstadoPedido.EnCamino, User.GetUsuarioId(),
                User.IsInRole(Roles.Superadmin)));

        [HttpPost("{id:int}/entregado")]
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Superadmin)]
        public async Task<ActionResult<PedidoResponse>> Entregado(int id) =>
            await Responder(await pedidos.AvanzarEntregaAsync(id, EstadoPedido.Entregado, User.GetUsuarioId(),
                User.IsInRole(Roles.Superadmin)));

        // ---- Detalle ----

        // Cliente: solo los suyos. Repartidor: solo los asignados a él. Ventas y superadmin: todos.
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PedidoResponse>> Obtener(int id)
        {
            var pedido = await pedidos.ObtenerAsync(id);
            var usuarioId = User.GetUsuarioId();
            var puedeVer = pedido is not null && (User.IsInRole(Roles.Ventas) || User.IsInRole(Roles.Superadmin)
                || (User.IsInRole(Roles.Cliente) && pedido.ClienteId == usuarioId)
                || (User.IsInRole(Roles.Repartidor) && pedido.RepartidorId == usuarioId));
            return puedeVer ? PedidoResponse.De(pedido!) : NotFound();
        }

        private async Task<ActionResult<PedidoResponse>> Responder(ResultadoPedido resultado)
        {
            if (resultado.Error is not null)
            {
                return Error(resultado);
            }
            var pedido = await pedidos.ObtenerAsync(resultado.PedidoId!.Value);
            return PedidoResponse.De(pedido!);
        }

        private ActionResult Error(ResultadoPedido resultado)
        {
            var cuerpo = new { mensaje = resultado.Mensaje };
            return resultado.Error switch
            {
                ErrorPedido.NoEncontrado => NotFound(cuerpo),
                ErrorPedido.Validacion => BadRequest(cuerpo),
                ErrorPedido.NoDisponible => StatusCode(StatusCodes.Status503ServiceUnavailable, cuerpo),
                _ => Conflict(cuerpo),
            };
        }
    }
}
