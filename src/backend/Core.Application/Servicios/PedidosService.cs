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
        NoDisponible,
        // El cupón dejó de servir entre la cotización y la confirmación (se agotó, venció...).
        CuponNoDisponible
    }

    public record ResultadoPedido(Guid? PedidoId, ErrorPedido? Error = null, string? Mensaje = null)
    {
        public static ResultadoPedido Ok(Guid pedidoId) => new(pedidoId);
        public static ResultadoPedido Falla(ErrorPedido error, string mensaje) => new(null, error, mensaje);
    }

    public record ItemNuevoPedido(Guid ProductoId, int Cantidad);

    // Una línea del carrito con el precio que se cobraría ahora (oferta incluida).
    public record LineaCotizada(Producto Producto, int Cantidad, decimal PrecioUsd, decimal PrecioListaUsd)
    {
        public decimal SubtotalUsd => PrecioUsd * Cantidad;
    }

    // Cuánto pagaría el cliente. Tasa null = la tienda todavía no cargó la tasa del día (no se
    // pueden crear pedidos, pero sí mostrar los montos en USD).
    public record Cotizacion(
        IReadOnlyList<LineaCotizada> Lineas,
        decimal? Tasa,
        Cupon? Cupon,
        decimal SubtotalUsd,
        decimal DescuentoUsd)
    {
        public decimal TotalUsd => SubtotalUsd - DescuentoUsd;
        public decimal? SubtotalBs => Tasa is null ? null : Lineas.Sum(l => TasaService.EnBs(l.PrecioUsd, Tasa)!.Value * l.Cantidad);
        // Acotado al subtotal en Bs para que el redondeo nunca deje un total negativo.
        public decimal? DescuentoBs => Tasa is null ? null : Math.Min(TasaService.EnBs(DescuentoUsd, Tasa)!.Value, SubtotalBs!.Value);
        public decimal? TotalBs => SubtotalBs - DescuentoBs;
    }

    public record ResultadoCotizacion(Cotizacion? Cotizacion, ErrorPedido? Error = null, string? Mensaje = null)
    {
        public static ResultadoCotizacion Falla(ErrorPedido error, string mensaje) => new(null, error, mensaje);
    }

    public record NuevoPedido(
        IReadOnlyList<ItemNuevoPedido> Items,
        MetodoPago MetodoPago,
        string ReferenciaPago,
        Guid ZonaId,
        string DireccionTexto,
        double? Latitud,
        double? Longitud,
        // Ya normalizado (+584XXXXXXXXX).
        string Telefono,
        string? CodigoCupon = null);

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
        ICuponRepository cupones,
        IUnitOfWork unidad,
        InventarioService inventario,
        ColaWhatsapp whatsapp,
        IAlmacenamientoArchivos archivos,
        ILogger<PedidosService> logger)
    {
        public const string MotivoRechazoPorDefecto = "el método de pago no procede";

        // ---- Cotizar (checkout) ----

        // Precios vigentes (con ofertas) y, si se indica, el descuento del cupón. No reserva nada:
        // el stock y el cupón se vuelven a comprobar de forma atómica al crear el pedido.
        public async Task<ResultadoCotizacion> CotizarAsync(Guid clienteId, IReadOnlyList<ItemNuevoPedido> items,
            string? codigoCupon, CancellationToken ct = default)
        {
            var tasa = (await configuracion.ObtenerAsync(ct)).TasaBsUsd;
            return await CotizarAsync(clienteId, Agrupar(items), codigoCupon, tasa, DateTime.UtcNow, ct);
        }

        private async Task<ResultadoCotizacion> CotizarAsync(Guid clienteId, Dictionary<Guid, int> cantidades,
            string? codigoCupon, decimal? tasa, DateTime ahora, CancellationToken ct)
        {
            var encontrados = await productos.ObtenerActivosAsync(cantidades.Keys, ct);
            var inexistentes = cantidades.Keys.Where(id => !encontrados.ContainsKey(id)).ToList();
            if (inexistentes.Count > 0)
            {
                return ResultadoCotizacion.Falla(ErrorPedido.Validacion,
                    $"Estos productos ya no están disponibles: {string.Join(", ", inexistentes)}.");
            }

            // Orden por producto: todas las transacciones bloquean productos en el mismo orden (sin deadlocks).
            var lineas = cantidades.OrderBy(c => c.Key)
                .Select(c => new LineaCotizada(encontrados[c.Key], c.Value,
                    encontrados[c.Key].PrecioVigenteUsd(ahora), encontrados[c.Key].PrecioUsd))
                .ToList();
            var subtotal = lineas.Sum(l => l.SubtotalUsd);

            Cupon? cupon = null;
            var descuento = 0m;
            if (!string.IsNullOrWhiteSpace(codigoCupon))
            {
                cupon = await cupones.ObtenerPorCodigoAsync(Cupon.NormalizarCodigo(codigoCupon), ct);
                if (cupon is null)
                {
                    return ResultadoCotizacion.Falla(ErrorPedido.Validacion, "El cupón no existe.");
                }
                if (cupon.MotivoNoAplicable(subtotal, ahora) is { } motivo)
                {
                    return ResultadoCotizacion.Falla(ErrorPedido.Validacion, motivo);
                }
                if (await cupones.ClienteLoUsoAsync(cupon.Id, clienteId, ct))
                {
                    return ResultadoCotizacion.Falla(ErrorPedido.Validacion, "Ya usaste este cupón en otro pedido.");
                }
                descuento = cupon.CalcularDescuento(subtotal);
            }

            return new ResultadoCotizacion(new Cotizacion(lineas, tasa, cupon, subtotal, descuento));
        }

        private static Dictionary<Guid, int> Agrupar(IEnumerable<ItemNuevoPedido> items) =>
            items.GroupBy(i => i.ProductoId).ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));

        // ---- Crear ----

        public async Task<ResultadoPedido> CrearAsync(Guid clienteId, NuevoPedido datos, ArchivoSubido captura,
            CancellationToken ct = default)
        {
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

            var ahora = DateTime.UtcNow;
            var cotizado = await CotizarAsync(clienteId, Agrupar(datos.Items), datos.CodigoCupon, tasa, ahora, ct);
            if (cotizado.Cotizacion is not { } cotizacion)
            {
                return ResultadoPedido.Falla(cotizado.Error!.Value, cotizado.Mensaje!);
            }

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
                CuponId = cotizacion.Cupon?.Id,
                DescuentoUsd = cotizacion.DescuentoUsd,
                DescuentoBs = cotizacion.DescuentoBs!.Value,
                TotalUsd = cotizacion.TotalUsd,
                TotalBs = cotizacion.TotalBs!.Value,
            };
            foreach (var linea in cotizacion.Lineas)
            {
                pedido.Items.Add(new PedidoItem
                {
                    ProductoId = linea.Producto.Id,
                    CategoriaId = linea.Producto.CategoriaId,
                    Cantidad = linea.Cantidad,
                    PrecioUsd = linea.PrecioUsd,
                    PrecioBs = TasaService.EnBs(linea.PrecioUsd, tasa)!.Value,
                    PrecioListaUsd = linea.PrecioListaUsd,
                });
            }
            pedido.RegistrarCreacion(clienteId, ahora);

            // La captura se sube antes de abrir la transacción, para no tener productos bloqueados
            // mientras se espera al almacenamiento. Si el pedido no se crea, se borra.
            pedido.CapturaUrl = await archivos.GuardarAsync(captura.Contenido, captura.Nombre, "capturas", ct);
            var creado = false;
            try
            {
                await using var tx = await unidad.IniciarTransaccionAsync(ct);
                pedidos.Agregar(pedido);

                foreach (var linea in cotizacion.Lineas)
                {
                    if (!await inventario.ReservarAsync(linea.Producto.Id, linea.Cantidad, pedido.Id, clienteId, ct))
                    {
                        await tx.RevertirAsync(ct);
                        unidad.LimpiarSeguimiento();
                        var quedan = (await productos.ObtenerAsync(linea.Producto.Id, ct: ct))?.StockDisponible ?? 0;
                        return ResultadoPedido.Falla(ErrorPedido.SinStock,
                            $"No hay suficiente stock de \"{linea.Producto.Nombre}\": " +
                            $"pediste {linea.Cantidad} y quedan {quedan}. Ajusta tu carrito e inténtalo de nuevo.");
                    }
                }

                // El cupón va después de los productos, en el mismo orden que al liberar (rechazo o
                // expiración), para no cruzar bloqueos. El UPDATE deja la fila del cupón bloqueada:
                // otro pedido del mismo cliente con el mismo cupón espera aquí y, cuando este
                // confirma, ya ve este pedido en la consulta de uso por cliente.
                if (cotizacion.Cupon is { } cupon)
                {
                    var motivo = !await cupones.ConsumirUsoAsync(cupon.Id, ahora, ct)
                        ? "El cupón se agotó o dejó de estar vigente mientras confirmabas. Quítalo e inténtalo de nuevo."
                        : await cupones.ClienteLoUsoAsync(cupon.Id, clienteId, ct)
                            ? "Ya usaste este cupón en otro pedido."
                            : null;
                    if (motivo is not null)
                    {
                        await tx.RevertirAsync(ct);
                        unidad.LimpiarSeguimiento();
                        return ResultadoPedido.Falla(ErrorPedido.CuponNoDisponible, motivo);
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
            EncolarMensaje(pedido, PlantillaWhatsapp.Aprobado);
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
            // Al cliente solo se le avisa la salida; la entrega la ve él mismo.
            if (nuevoEstado == EstadoPedido.EnCamino)
            {
                EncolarMensaje(pedido, PlantillaWhatsapp.EnCamino);
            }
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
            return ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"El pedido #{pedido.Numero} venció sin ser revisado y se canceló; su stock volvió a la tienda.");
        }

        private async Task ExpirarBloqueadoAsync(Pedido pedido, CancellationToken ct)
        {
            await LiberarStockAsync(pedido, null, ct);
            pedido.CambiarEstado(EstadoPedido.Expirado, null, DateTime.UtcNow);
            await unidad.GuardarCambiosAsync(ct);
        }

        // Devuelve el stock reservado y, si el pedido usó cupón, su uso (el cliente puede volver a usarlo).
        private async Task LiberarStockAsync(Pedido pedido, Guid? usuarioId, CancellationToken ct)
        {
            foreach (var item in pedido.Items.OrderBy(i => i.ProductoId))
            {
                await inventario.LiberarAsync(item.ProductoId, item.Cantidad, pedido.Id, usuarioId, ct);
            }
            if (pedido.CuponId is Guid cuponId)
            {
                await cupones.LiberarUsoAsync(cuponId, ct);
            }
        }

        private static ResultadoPedido EstadoInvalido(Pedido pedido, string accion) =>
            ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"No se puede {accion} el pedido #{pedido.Numero} porque está en estado \"{pedido.Estado}\".");

        // WhatsApp al cliente solo en dos momentos, para no abrumarlo: compra aprobada y pedido en
        // camino. Después del commit: un fallo aquí no deshace el cambio de estado, solo se registra.
        private void EncolarMensaje(Pedido pedido, PlantillaWhatsapp plantilla)
        {
            try
            {
                whatsapp.Encolar(pedido, plantilla);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "No se pudo encolar el WhatsApp {Plantilla} del pedido {PedidoId}.", plantilla, pedido.Id);
            }
        }
    }
}
