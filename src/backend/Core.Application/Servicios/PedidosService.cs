using Core.Application.Abstracciones;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using Microsoft.Extensions.Logging;

namespace Core.Application.Servicios
{
    public enum ErrorPedido
    {
        NoEncontrado,
        Validacion,
        EstadoInvalido,
        SinStock,
        NoDisponible
    }

    public record ResultadoPedido(Guid? PedidoId, ErrorPedido? Error = null, string? Mensaje = null)
    {
        public static ResultadoPedido Ok(Guid pedidoId) => new(pedidoId);
        public static ResultadoPedido Falla(ErrorPedido error, string mensaje) => new(null, error, mensaje);
    }

    public record ItemNuevoPedido(Guid ProductoId, int Cantidad);

    public record NuevoPedido(
        IReadOnlyList<ItemNuevoPedido> Items,
        MetodoPago MetodoPago,
        string ReferenciaPago,
        Guid ZonaId,
        string DireccionTexto,
        double? Latitud,
        double? Longitud,
        // Ya normalizado (+584XXXXXXXXX).
        string Telefono);

    public record ArchivoSubido(Stream Contenido, string Nombre);

    // Ciclo de vida del pedido. Cada operación bloquea la fila del pedido dentro de una
    // transacción, así que dos vendedores o el job de expiración no pueden mover el mismo pedido
    // a la vez. Los mensajes de WhatsApp se encolan solo después del commit.
    public class PedidosService(
        IPedidoRepository pedidos,
        IProductoRepository productos,
        IUsuarioRepository usuarios,
        IZonaRepository zonas,
        IConfiguracionRepository configuracion,
        INotificacionRepository notificaciones,
        IUnitOfWork unidad,
        InventarioService inventario,
        ColaWhatsapp whatsapp,
        IAlmacenamientoArchivos archivos,
        ILogger<PedidosService> logger)
    {
        public const string MotivoRechazoPorDefecto = "el método de pago no procede";

        // ---- Crear ----

        public async Task<ResultadoPedido> CrearAsync(Guid clienteId, NuevoPedido datos, ArchivoSubido captura,
            CancellationToken ct = default)
        {
            var cantidades = datos.Items
                .GroupBy(i => i.ProductoId)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));

            var config = await configuracion.ObtenerAsync(ct);
            if (config.TasaBsUsd is not decimal tasa)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoDisponible,
                    "La tienda todavía no tiene cargada la tasa del día. Intenta más tarde.");
            }

            if (!await zonas.ExisteActivaAsync(datos.ZonaId, ct))
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion, "La zona de entrega no existe o no está activa.");
            }

            var encontrados = await productos.ObtenerActivosAsync(cantidades.Keys, ct);
            var inexistentes = cantidades.Keys.Where(id => !encontrados.ContainsKey(id)).ToList();
            if (inexistentes.Count > 0)
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion,
                    $"Estos productos ya no están disponibles: {string.Join(", ", inexistentes)}.");
            }

            var ahora = DateTime.UtcNow;
            var pedido = new Pedido
            {
                Id = Guid.CreateVersion7(),
                ClienteId = clienteId,
                Estado = EstadoPedido.Pendiente,
                MetodoPago = datos.MetodoPago,
                // Transferencia y pago móvil se pagan en Bs; Binance en USDT 1:1.
                MonedaPago = datos.MetodoPago == MetodoPago.Binance ? MonedaPago.Usdt : MonedaPago.Ves,
                TasaCambio = tasa,
                ReferenciaPago = datos.ReferenciaPago.Trim(),
                ZonaId = datos.ZonaId,
                DireccionTexto = datos.DireccionTexto.Trim(),
                Latitud = datos.Latitud,
                Longitud = datos.Longitud,
                TelefonoContacto = datos.Telefono,
                CreatedAt = ahora,
                ExpiraEn = ahora.AddHours(config.HorasExpiracion),
            };
            // Orden por producto: todas las transacciones bloquean productos en el mismo orden (sin deadlocks).
            foreach (var (productoId, cantidad) in cantidades.OrderBy(c => c.Key))
            {
                var producto = encontrados[productoId];
                pedido.Items.Add(new PedidoItem
                {
                    ProductoId = productoId,
                    CategoriaId = producto.CategoriaId,
                    Cantidad = cantidad,
                    PrecioUsd = producto.PrecioUsd,
                    PrecioBs = TasaService.EnBs(producto.PrecioUsd, tasa)!.Value,
                });
            }
            pedido.TotalUsd = pedido.Items.Sum(i => i.PrecioUsd * i.Cantidad);
            pedido.TotalBs = pedido.Items.Sum(i => i.PrecioBs * i.Cantidad);
            pedido.RegistrarCreacion(clienteId, ahora);

            // La captura se sube antes de abrir la transacción, para no tener productos bloqueados
            // mientras se espera al almacenamiento. Si el pedido no se crea, se borra.
            pedido.CapturaUrl = await archivos.GuardarAsync(captura.Contenido, captura.Nombre, "capturas", ct);
            var creado = false;
            try
            {
                await using var tx = await unidad.IniciarTransaccionAsync(ct);
                pedidos.Agregar(pedido);

                foreach (var item in pedido.Items)
                {
                    if (!await inventario.ReservarAsync(item.ProductoId, item.Cantidad, pedido.Id, clienteId, ct))
                    {
                        await tx.RevertirAsync(ct);
                        unidad.LimpiarSeguimiento();
                        var quedan = (await productos.ObtenerAsync(item.ProductoId, ct: ct))?.StockDisponible ?? 0;
                        return ResultadoPedido.Falla(ErrorPedido.SinStock,
                            $"No hay suficiente stock de \"{encontrados[item.ProductoId].Nombre}\": " +
                            $"pediste {item.Cantidad} y quedan {quedan}. Ajusta tu carrito e inténtalo de nuevo.");
                    }
                }

                notificaciones.Agregar(new Notificacion { Tipo = TipoNotificacion.PedidoNuevo, PedidoId = pedido.Id });
                // El teléfono queda en el cliente para poder buscar su historial por teléfono.
                await usuarios.AsignarTelefonoSiVacioAsync(clienteId, datos.Telefono, ct);

                await unidad.GuardarCambiosAsync(ct);
                await tx.ConfirmarAsync(ct);
                creado = true;
            }
            finally
            {
                if (!creado)
                {
                    await archivos.EliminarAsync(pedido.CapturaUrl);
                }
            }

            return ResultadoPedido.Ok(pedido.Id);
        }

        // ---- Revisión (ventas / superadmin) ----

        public async Task<ResultadoPedido> AprobarAsync(Guid pedidoId, Guid repartidorId, Guid usuarioId,
            CancellationToken ct = default)
        {
            if (!await usuarios.ExisteActivoConRolAsync(repartidorId, RolUsuario.Repartidor, ct))
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion, "El repartidor no existe o está desactivado.");
            }

            await using var tx = await unidad.IniciarTransaccionAsync(ct);
            var pedido = await pedidos.BloquearParaActualizarAsync(pedidoId, ct);
            if (pedido is null)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe.");
            }
            if (await ExpirarSiVencioAsync(pedido, tx, ct) is { } vencido)
            {
                return vencido;
            }
            if (pedido.Estado != EstadoPedido.Pendiente)
            {
                return EstadoInvalido(pedido, "aprobar");
            }

            foreach (var item in pedido.Items.OrderBy(i => i.ProductoId))
            {
                await inventario.ConfirmarVentaAsync(item.ProductoId, item.Cantidad, pedido.Id, usuarioId, ct);
            }

            var ahora = DateTime.UtcNow;
            pedido.RevisadoPorId = usuarioId;
            pedido.RevisadoEn = ahora;
            pedido.RepartidorId = repartidorId;
            pedido.AsignadoEn = ahora;
            pedido.CambiarEstado(EstadoPedido.Aprobado, usuarioId, ahora);
            pedido.CambiarEstado(EstadoPedido.Asignado, usuarioId, ahora);

            await unidad.GuardarCambiosAsync(ct);
            await tx.ConfirmarAsync(ct);
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Aprobado, ct);
            return ResultadoPedido.Ok(pedido.Id);
        }

        public async Task<ResultadoPedido> RechazarAsync(Guid pedidoId, string? motivo, Guid usuarioId,
            CancellationToken ct = default)
        {
            await using var tx = await unidad.IniciarTransaccionAsync(ct);
            var pedido = await pedidos.BloquearParaActualizarAsync(pedidoId, ct);
            if (pedido is null)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe.");
            }
            if (await ExpirarSiVencioAsync(pedido, tx, ct) is { } vencido)
            {
                return vencido;
            }
            if (pedido.Estado != EstadoPedido.Pendiente)
            {
                return EstadoInvalido(pedido, "rechazar");
            }

            await LiberarStockAsync(pedido, usuarioId, ct);

            var ahora = DateTime.UtcNow;
            pedido.RevisadoPorId = usuarioId;
            pedido.RevisadoEn = ahora;
            pedido.MotivoRechazo = string.IsNullOrWhiteSpace(motivo) ? MotivoRechazoPorDefecto : motivo.Trim();
            pedido.CambiarEstado(EstadoPedido.Rechazado, usuarioId, ahora);

            await unidad.GuardarCambiosAsync(ct);
            await tx.ConfirmarAsync(ct);
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Rechazado, ct);
            return ResultadoPedido.Ok(pedido.Id);
        }

        // ---- Entrega (repartidor / superadmin) ----

        // nuevoEstado: EnCamino o Entregado. Un repartidor solo puede mover sus propios pedidos.
        public async Task<ResultadoPedido> AvanzarEntregaAsync(Guid pedidoId, EstadoPedido nuevoEstado, Guid usuarioId,
            bool esSuperadmin, CancellationToken ct = default)
        {
            if (nuevoEstado is not (EstadoPedido.EnCamino or EstadoPedido.Entregado))
            {
                throw new ArgumentOutOfRangeException(nameof(nuevoEstado));
            }

            await using var tx = await unidad.IniciarTransaccionAsync(ct);
            var pedido = await pedidos.BloquearParaActualizarAsync(pedidoId, ct);
            if (pedido is null || (!esSuperadmin && pedido.RepartidorId != usuarioId))
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe o no está asignado a ti.");
            }
            if (!TransicionesPedido.EsLegal(pedido.Estado, nuevoEstado))
            {
                return EstadoInvalido(pedido, nuevoEstado == EstadoPedido.EnCamino ? "marcar en camino" : "marcar entregado");
            }

            var ahora = DateTime.UtcNow;
            if (nuevoEstado == EstadoPedido.EnCamino)
            {
                pedido.EnCaminoEn = ahora;
            }
            else
            {
                pedido.EntregadoEn = ahora;
            }
            pedido.CambiarEstado(nuevoEstado, usuarioId, ahora);

            await unidad.GuardarCambiosAsync(ct);
            await tx.ConfirmarAsync(ct);
            await EncolarMensajeAsync(pedido,
                nuevoEstado == EstadoPedido.EnCamino ? PlantillaWhatsapp.EnCamino : PlantillaWhatsapp.Entregado, ct);
            return ResultadoPedido.Ok(pedido.Id);
        }

        // ---- Expiración (job) ----

        // Expira los pedidos pendientes vencidos, cada uno en su propia transacción para que un
        // error en uno no frene a los demás. Devuelve cuántos expiró.
        public async Task<int> ExpirarVencidosAsync(CancellationToken ct)
        {
            var ids = await pedidos.ListarIdsVencidosAsync(DateTime.UtcNow, 500, ct);

            var expirados = 0;
            foreach (var id in ids)
            {
                ct.ThrowIfCancellationRequested();
                unidad.LimpiarSeguimiento();
                try
                {
                    await using var tx = await unidad.IniciarTransaccionAsync(ct);
                    var pedido = await pedidos.BloquearParaActualizarAsync(id, ct);
                    // Puede que ventas lo haya revisado entre la consulta y el bloqueo.
                    if (pedido is null || pedido.Estado != EstadoPedido.Pendiente || pedido.ExpiraEn > DateTime.UtcNow)
                    {
                        continue;
                    }

                    await ExpirarBloqueadoAsync(pedido, ct);
                    await tx.ConfirmarAsync(ct);
                    await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Expirado, ct);
                    expirados++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "No se pudo expirar el pedido {PedidoId}.", id);
                }
            }
            return expirados;
        }

        // Aviso para el panel de ventas: pedidos pendientes a los que les queda menos de `margen`.
        public async Task<int> AvisarPorExpirarAsync(TimeSpan margen, CancellationToken ct)
        {
            unidad.LimpiarSeguimiento();
            var ahora = DateTime.UtcNow;
            var ids = await pedidos.ListarIdsPorExpirarSinAvisoAsync(ahora, ahora + margen, ct);
            foreach (var id in ids)
            {
                notificaciones.Agregar(new Notificacion { Tipo = TipoNotificacion.PedidoPorExpirar, PedidoId = id });
            }
            await unidad.GuardarCambiosAsync(ct);
            return ids.Count;
        }

        // ---- Internos ----

        // Si un pendiente ya pasó su hora de expiración pero el job aún no lo procesó, se expira
        // aquí mismo en lugar de dejar que ventas lo apruebe o rechace.
        private async Task<ResultadoPedido?> ExpirarSiVencioAsync(Pedido pedido, ITransaccion tx, CancellationToken ct)
        {
            if (pedido.Estado != EstadoPedido.Pendiente || pedido.ExpiraEn > DateTime.UtcNow)
            {
                return null;
            }

            await ExpirarBloqueadoAsync(pedido, ct);
            await tx.ConfirmarAsync(ct);
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Expirado, ct);
            return ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"El pedido #{pedido.Numero} venció sin ser revisado y se canceló; su stock volvió a la tienda.");
        }

        private async Task ExpirarBloqueadoAsync(Pedido pedido, CancellationToken ct)
        {
            await LiberarStockAsync(pedido, null, ct);
            pedido.CambiarEstado(EstadoPedido.Expirado, null, DateTime.UtcNow);
            await unidad.GuardarCambiosAsync(ct);
        }

        private async Task LiberarStockAsync(Pedido pedido, Guid? usuarioId, CancellationToken ct)
        {
            foreach (var item in pedido.Items.OrderBy(i => i.ProductoId))
            {
                await inventario.LiberarAsync(item.ProductoId, item.Cantidad, pedido.Id, usuarioId, ct);
            }
        }

        private static ResultadoPedido EstadoInvalido(Pedido pedido, string accion) =>
            ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"No se puede {accion} el pedido #{pedido.Numero} porque está en estado \"{pedido.Estado}\".");

        // Después del commit: un fallo aquí no deshace el cambio de estado, solo se registra.
        private async Task EncolarMensajeAsync(Pedido pedido, PlantillaWhatsapp plantilla, CancellationToken ct)
        {
            try
            {
                var soporte = (await configuracion.ObtenerAsync(ct)).NumeroSoporte;
                whatsapp.Encolar(pedido, plantilla, soporte);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "No se pudo encolar el WhatsApp {Plantilla} del pedido {PedidoId}.", plantilla, pedido.Id);
            }
        }
    }
}
