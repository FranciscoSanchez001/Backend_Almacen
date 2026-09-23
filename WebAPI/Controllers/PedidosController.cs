using System.Text.Json;
using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Application.Servicios;
using Backend_Almacen.Domain.Enums;
using Backend_Almacen.Domain.Reglas;
using Backend_Almacen.WebAPI.Auth;
using Backend_Almacen.WebAPI.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Backend_Almacen.WebAPI.Controllers
{
    [ApiController]
    [Route("pedidos")]
    [Authorize]
    public class PedidosController(
        IPedidoRepository repositorio,
        IUsuarioRepository usuarios,
        PedidosService pedidos) : ControllerBase
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

            await using var contenido = captura.OpenReadStream();
            var resultado = await pedidos.CrearAsync(User.GetUsuarioId(), new NuevoPedido(
                form.Items.Select(i => new ItemNuevoPedido(i.ProductoId, i.Cantidad)).ToList(),
                metodo!.Value,
                form.ReferenciaPago,
                form.ZonaId,
                form.DireccionTexto,
                form.Latitud,
                form.Longitud,
                telefono!), new ArchivoSubido(contenido, captura.FileName), ct);

            if (resultado.Error is not null)
            {
                return Error(resultado);
            }
            var pedido = await repositorio.ObtenerDetalleAsync(resultado.PedidoId!.Value, ct);
            return CreatedAtAction(nameof(Obtener), new { id = pedido!.Id }, PedidoResponse.De(pedido));
        }

        // Mis pedidos: estado de cada uno e historial completo.
        [HttpGet("mios")]
        [Authorize(Roles = Roles.Cliente)]
        public async Task<Pagina<PedidoResponse>> Mios([FromQuery] int pagina = 1, [FromQuery] int tamano = 20,
            CancellationToken ct = default) =>
            (await repositorio.ListarAsync(new FiltroPedidos(ClienteId: User.GetUsuarioId()), pagina, tamano, ct))
                .Convertir(PedidoResponse.De);

        // ---- Panel de ventas / superadmin ----

        // Bandeja: con estado=pendiente salen primero los que están más cerca de vencer.
        [HttpGet]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<Pagina<PedidoResponse>>> Listar(
            [FromQuery(Name = "estado")] string? estadoTexto,
            [FromQuery] Guid? zonaId,
            [FromQuery] Guid? repartidorId,
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 20,
            CancellationToken ct = default)
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

            var filtro = new FiltroPedidos(
                Estados: estado is null ? null : [estado.Value],
                RepartidorId: repartidorId,
                ZonaId: zonaId,
                Desde: desde is null ? null : DateTime.SpecifyKind(desde.Value, DateTimeKind.Utc),
                Hasta: hasta is null ? null : DateTime.SpecifyKind(hasta.Value, DateTimeKind.Utc),
                Orden: estado == EstadoPedido.Pendiente ? OrdenPedidos.MasUrgentes : OrdenPedidos.MasRecientes);
            return (await repositorio.ListarAsync(filtro, pagina, tamano, ct)).Convertir(PedidoResponse.De);
        }

        // Para el selector de "Aprobar": repartidores activos y cuántos pedidos llevan en curso.
        [HttpGet("repartidores")]
        [Authorize(Roles = Roles.Personal)]
        public Task<List<RepartidorConCarga>> Repartidores(CancellationToken ct) =>
            usuarios.ListarRepartidoresActivosAsync(ct);

        [HttpPost("{id:guid}/aprobar")]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<PedidoResponse>> Aprobar(Guid id, AprobarPedidoRequest req, CancellationToken ct) =>
            await Responder(await pedidos.AprobarAsync(id, req.RepartidorId, User.GetUsuarioId(), ct), ct);

        [HttpPost("{id:guid}/rechazar")]
        [Authorize(Roles = Roles.Personal)]
        public async Task<ActionResult<PedidoResponse>> Rechazar(Guid id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RechazarPedidoRequest? req, CancellationToken ct) =>
            await Responder(await pedidos.RechazarAsync(id, req?.Motivo, User.GetUsuarioId(), ct), ct);

        // ---- Repartidor (solo sus pedidos) / superadmin ----

        [HttpPost("{id:guid}/en-camino")]
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Superadmin)]
        public async Task<ActionResult<PedidoResponse>> EnCamino(Guid id, CancellationToken ct) =>
            await Responder(await pedidos.AvanzarEntregaAsync(id, EstadoPedido.EnCamino, User.GetUsuarioId(),
                User.IsInRole(Roles.Superadmin), ct), ct);

        [HttpPost("{id:guid}/entregado")]
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Superadmin)]
        public async Task<ActionResult<PedidoResponse>> Entregado(Guid id, CancellationToken ct) =>
            await Responder(await pedidos.AvanzarEntregaAsync(id, EstadoPedido.Entregado, User.GetUsuarioId(),
                User.IsInRole(Roles.Superadmin), ct), ct);

        // ---- Detalle ----

        // Cliente: solo los suyos. Repartidor: solo los asignados a él. Ventas y superadmin: todos.
        [HttpGet("{id:guid}")]
        public async Task<ActionResult<PedidoResponse>> Obtener(Guid id, CancellationToken ct)
        {
            var pedido = await repositorio.ObtenerDetalleAsync(id, ct);
            var usuarioId = User.GetUsuarioId();
            var puedeVer = pedido is not null && (User.IsInRole(Roles.Ventas) || User.IsInRole(Roles.Superadmin)
                || (User.IsInRole(Roles.Cliente) && pedido.ClienteId == usuarioId)
                || (User.IsInRole(Roles.Repartidor) && pedido.RepartidorId == usuarioId));
            return puedeVer ? PedidoResponse.De(pedido!) : NotFound();
        }

        private async Task<ActionResult<PedidoResponse>> Responder(ResultadoPedido resultado, CancellationToken ct)
        {
            if (resultado.Error is not null)
            {
                return Error(resultado);
            }
            var pedido = await repositorio.ObtenerDetalleAsync(resultado.PedidoId!.Value, ct);
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
