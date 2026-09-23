using Backend_Almacen.Data;
using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Services
{
    public enum ErrorPedido
    {
        NoEncontrado,
        Validacion,
        EstadoInvalido,
        SinStock,
        NoDisponible
    }

    public record ResultadoPedido(int? PedidoId, ErrorPedido? Error = null, string? Mensaje = null)
    {
        public static ResultadoPedido Ok(int pedidoId) => new(pedidoId);
        public static ResultadoPedido Falla(ErrorPedido error, string mensaje) => new(null, error, mensaje);
    }

    public record NuevoPedido(
        IReadOnlyList<(int ProductoId, int Cantidad)> Items,
        MetodoPago MetodoPago,
        string ReferenciaPago,
        int ZonaId,
        string DireccionTexto,
        double? Latitud,
        double? Longitud,
        string Telefono);

    // Ciclo de vida del pedido. Cada operación bloquea la fila del pedido (SELECT ... FOR UPDATE)
    // dentro de una transacción, así que dos vendedores o el job de expiración no pueden mover
    // el mismo pedido a la vez. Los mensajes de WhatsApp se encolan solo después del commit.
    public class PedidosService(
        AlmacenDbContext db,
        InventarioService inventario,
        ColaWhatsapp whatsapp,
        IAlmacenamientoArchivos archivos,
        ILogger<PedidosService> logger)
    {
        public const string MotivoRechazoPorDefecto = "el método de pago no procede";

        // Cambios de estado legales. Aprobar pasa por "aprobado" y "asignado" en la misma
        // operación, porque no se puede aprobar sin elegir repartidor.
        private static readonly Dictionary<EstadoPedido, EstadoPedido[]> Transiciones = new()
        {
            [EstadoPedido.Pendiente] = [EstadoPedido.Aprobado, EstadoPedido.Rechazado, EstadoPedido.Expirado],
            [EstadoPedido.Aprobado] = [EstadoPedido.Asignado],
            [EstadoPedido.Asignado] = [EstadoPedido.EnCamino],
            [EstadoPedido.EnCamino] = [EstadoPedido.Entregado],
        };

        public static bool EsTransicionLegal(EstadoPedido desde, EstadoPedido hacia) =>
            Transiciones.TryGetValue(desde, out var destinos) && destinos.Contains(hacia);

        // ---- Consultas ----

        public IQueryable<Pedido> ConDetalle() => db.Pedidos.AsNoTracking()
            .Include(p => p.Cliente)
            .Include(p => p.Zona)
            .Include(p => p.RevisadoPor)
            .Include(p => p.Repartidor)
            .Include(p => p.Items).ThenInclude(i => i.Producto)
            .Include(p => p.Items).ThenInclude(i => i.Categoria)
            .Include(p => p.HistorialEstados).ThenInclude(h => h.Usuario)
            .AsSplitQuery();

        public Task<Pedido?> ObtenerAsync(int id) => ConDetalle().SingleOrDefaultAsync(p => p.Id == id);

        // ---- Crear ----

        public async Task<ResultadoPedido> CrearAsync(int clienteId, NuevoPedido datos, IFormFile captura,
            CancellationToken ct = default)
        {
            var cantidades = datos.Items
                .GroupBy(i => i.ProductoId)
                .ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));

            var config = await db.Configuracion.AsNoTracking().SingleAsync(c => c.Id == 1, ct);
            if (config.TasaBsUsd is not decimal tasa)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoDisponible,
                    "La tienda todavía no tiene cargada la tasa del día. Intenta más tarde.");
            }

            if (!await db.Zonas.AnyAsync(z => z.Id == datos.ZonaId && z.Activa, ct))
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion, "La zona de entrega no existe o no está activa.");
            }

            var ids = cantidades.Keys.ToList();
            var productos = await db.Productos.AsNoTracking()
                .Where(p => ids.Contains(p.Id) && p.Activo)
                .ToDictionaryAsync(p => p.Id, ct);
            var inexistentes = ids.Where(id => !productos.ContainsKey(id)).ToList();
            if (inexistentes.Count > 0)
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion,
                    $"Estos productos ya no están disponibles: {string.Join(", ", inexistentes)}.");
            }

            var ahora = DateTime.UtcNow;
            var pedido = new Pedido
            {
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
                CreadoEn = ahora,
                ExpiraEn = ahora.AddHours(config.HorasExpiracion),
            };
            // Orden por producto: todas las transacciones bloquean productos en el mismo orden (sin deadlocks).
            foreach (var (productoId, cantidad) in cantidades.OrderBy(c => c.Key))
            {
                var producto = productos[productoId];
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
            pedido.HistorialEstados.Add(new HistorialEstadoPedido
            {
                EstadoAnterior = null,
                EstadoNuevo = EstadoPedido.Pendiente,
                UsuarioId = clienteId,
                CreadoEn = ahora,
            });

            // La captura se sube antes de abrir la transacción, para no tener productos bloqueados
            // mientras se espera a Cloudinary. Si el pedido no se crea, se borra.
            pedido.CapturaUrl = await archivos.GuardarAsync(captura, "capturas", ct);
            var creado = false;
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync(ct);
                db.Pedidos.Add(pedido);
                await db.SaveChangesAsync(ct);

                foreach (var item in pedido.Items)
                {
                    if (!await inventario.ReservarAsync(item.ProductoId, item.Cantidad, pedido.Id, clienteId))
                    {
                        await tx.RollbackAsync(ct);
                        db.ChangeTracker.Clear();
                        var quedan = await db.Productos.AsNoTracking()
                            .Where(p => p.Id == item.ProductoId).Select(p => p.StockDisponible).SingleAsync(ct);
                        return ResultadoPedido.Falla(ErrorPedido.SinStock,
                            $"No hay suficiente stock de \"{productos[item.ProductoId].Nombre}\": " +
                            $"pediste {item.Cantidad} y quedan {quedan}. Ajusta tu carrito e inténtalo de nuevo.");
                    }
                }

                db.Notificaciones.Add(new Notificacion { Tipo = TipoNotificacion.PedidoNuevo, PedidoId = pedido.Id });
                // El teléfono queda en el cliente para poder buscar su historial por teléfono.
                await db.Usuarios
                    .Where(u => u.Id == clienteId && u.Telefono == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(u => u.Telefono, datos.Telefono), ct);

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
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

        public async Task<ResultadoPedido> AprobarAsync(int pedidoId, int repartidorId, int usuarioId)
        {
            if (!await db.Usuarios.AnyAsync(u => u.Id == repartidorId && u.Rol == RolUsuario.Repartidor && u.Activo))
            {
                return ResultadoPedido.Falla(ErrorPedido.Validacion, "El repartidor no existe o está desactivado.");
            }

            await using var tx = await db.Database.BeginTransactionAsync();
            var pedido = await BloquearAsync(pedidoId);
            if (pedido is null)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe.");
            }
            if (await ExpirarSiVencioAsync(pedido, tx) is { } vencido)
            {
                return vencido;
            }
            if (pedido.Estado != EstadoPedido.Pendiente)
            {
                return EstadoInvalido(pedido, "aprobar");
            }

            foreach (var item in pedido.Items.OrderBy(i => i.ProductoId))
            {
                await inventario.ConfirmarVentaAsync(item.ProductoId, item.Cantidad, pedido.Id, usuarioId);
            }

            var ahora = DateTime.UtcNow;
            pedido.RevisadoPorId = usuarioId;
            pedido.RevisadoEn = ahora;
            pedido.RepartidorId = repartidorId;
            pedido.AsignadoEn = ahora;
            CambiarEstado(pedido, EstadoPedido.Aprobado, usuarioId, ahora);
            CambiarEstado(pedido, EstadoPedido.Asignado, usuarioId, ahora);

            await db.SaveChangesAsync();
            await tx.CommitAsync();
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Aprobado);
            return ResultadoPedido.Ok(pedido.Id);
        }

        public async Task<ResultadoPedido> RechazarAsync(int pedidoId, string? motivo, int usuarioId)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var pedido = await BloquearAsync(pedidoId);
            if (pedido is null)
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe.");
            }
            if (await ExpirarSiVencioAsync(pedido, tx) is { } vencido)
            {
                return vencido;
            }
            if (pedido.Estado != EstadoPedido.Pendiente)
            {
                return EstadoInvalido(pedido, "rechazar");
            }

            await LiberarStockAsync(pedido, usuarioId);

            var ahora = DateTime.UtcNow;
            pedido.RevisadoPorId = usuarioId;
            pedido.RevisadoEn = ahora;
            pedido.MotivoRechazo = string.IsNullOrWhiteSpace(motivo) ? MotivoRechazoPorDefecto : motivo.Trim();
            CambiarEstado(pedido, EstadoPedido.Rechazado, usuarioId, ahora);

            await db.SaveChangesAsync();
            await tx.CommitAsync();
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Rechazado);
            return ResultadoPedido.Ok(pedido.Id);
        }

        // ---- Entrega (repartidor / superadmin) ----

        // nuevoEstado: EnCamino o Entregado. Un repartidor solo puede mover sus propios pedidos.
        public async Task<ResultadoPedido> AvanzarEntregaAsync(int pedidoId, EstadoPedido nuevoEstado, int usuarioId,
            bool esSuperadmin)
        {
            if (nuevoEstado is not (EstadoPedido.EnCamino or EstadoPedido.Entregado))
            {
                throw new ArgumentOutOfRangeException(nameof(nuevoEstado));
            }

            await using var tx = await db.Database.BeginTransactionAsync();
            var pedido = await BloquearAsync(pedidoId);
            if (pedido is null || (!esSuperadmin && pedido.RepartidorId != usuarioId))
            {
                return ResultadoPedido.Falla(ErrorPedido.NoEncontrado, "El pedido no existe o no está asignado a ti.");
            }
            if (!EsTransicionLegal(pedido.Estado, nuevoEstado))
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
            CambiarEstado(pedido, nuevoEstado, usuarioId, ahora);

            await db.SaveChangesAsync();
            await tx.CommitAsync();
            await EncolarMensajeAsync(pedido,
                nuevoEstado == EstadoPedido.EnCamino ? PlantillaWhatsapp.EnCamino : PlantillaWhatsapp.Entregado);
            return ResultadoPedido.Ok(pedido.Id);
        }

        // ---- Expiración (job) ----

        // Expira los pedidos pendientes vencidos. Cada uno en su propia transacción, para que un
        // error en uno no frene a los demás. Devuelve cuántos expiró.
        public async Task<int> ExpirarVencidosAsync(CancellationToken ct)
        {
            var ahora = DateTime.UtcNow;
            var ids = await db.Pedidos.AsNoTracking()
                .Where(p => p.Estado == EstadoPedido.Pendiente && p.ExpiraEn <= ahora)
                .OrderBy(p => p.ExpiraEn)
                .Select(p => p.Id)
                .Take(500)
                .ToListAsync(ct);

            var expirados = 0;
            foreach (var id in ids)
            {
                ct.ThrowIfCancellationRequested();
                db.ChangeTracker.Clear();
                try
                {
                    await using var tx = await db.Database.BeginTransactionAsync(ct);
                    var pedido = await BloquearAsync(id);
                    // Puede que ventas lo haya revisado entre la consulta y el bloqueo.
                    if (pedido is null || pedido.Estado != EstadoPedido.Pendiente || pedido.ExpiraEn > DateTime.UtcNow)
                    {
                        continue;
                    }

                    await ExpirarBloqueadoAsync(pedido);
                    await tx.CommitAsync(ct);
                    await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Expirado);
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
            db.ChangeTracker.Clear();
            var ahora = DateTime.UtcNow;
            var limite = ahora + margen;
            var ids = await db.Pedidos.AsNoTracking()
                .Where(p => p.Estado == EstadoPedido.Pendiente && p.ExpiraEn > ahora && p.ExpiraEn <= limite)
                .Where(p => !db.Notificaciones.Any(n => n.PedidoId == p.Id && n.Tipo == TipoNotificacion.PedidoPorExpirar))
                .Select(p => p.Id)
                .ToListAsync(ct);

            foreach (var id in ids)
            {
                db.Notificaciones.Add(new Notificacion { Tipo = TipoNotificacion.PedidoPorExpirar, PedidoId = id });
            }
            await db.SaveChangesAsync(ct);
            return ids.Count;
        }

        // ---- Internos ----

        // Bloquea la fila hasta el fin de la transacción y la carga con lo necesario para operar
        // y para armar los mensajes.
        private async Task<Pedido?> BloquearAsync(int pedidoId)
        {
            var bloqueados = await db.Database
                .SqlQuery<int>($"SELECT id AS \"Value\" FROM pedidos WHERE id = {pedidoId} FOR UPDATE")
                .ToListAsync();
            if (bloqueados.Count == 0)
            {
                return null;
            }

            return await db.Pedidos
                .Include(p => p.Items)
                .Include(p => p.Cliente)
                .Include(p => p.Zona)
                .SingleAsync(p => p.Id == pedidoId);
        }

        // Si un pendiente ya pasó su hora de expiración pero el job aún no lo procesó, se expira
        // aquí mismo en lugar de dejar que ventas lo apruebe o rechace.
        private async Task<ResultadoPedido?> ExpirarSiVencioAsync(Pedido pedido,
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction tx)
        {
            if (pedido.Estado != EstadoPedido.Pendiente || pedido.ExpiraEn > DateTime.UtcNow)
            {
                return null;
            }

            await ExpirarBloqueadoAsync(pedido);
            await tx.CommitAsync();
            await EncolarMensajeAsync(pedido, PlantillaWhatsapp.Expirado);
            return ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"El pedido #{pedido.Id} venció sin ser revisado y se canceló; su stock volvió a la tienda.");
        }

        private async Task ExpirarBloqueadoAsync(Pedido pedido)
        {
            await LiberarStockAsync(pedido, null);
            CambiarEstado(pedido, EstadoPedido.Expirado, null, DateTime.UtcNow);
            await db.SaveChangesAsync();
        }

        private async Task LiberarStockAsync(Pedido pedido, int? usuarioId)
        {
            foreach (var item in pedido.Items.OrderBy(i => i.ProductoId))
            {
                await inventario.LiberarAsync(item.ProductoId, item.Cantidad, pedido.Id, usuarioId);
            }
        }

        // Toda transición pasa por aquí: valida que sea legal y deja la línea en historial_estados_pedido.
        private static void CambiarEstado(Pedido pedido, EstadoPedido nuevo, int? usuarioId, DateTime ahora)
        {
            if (!EsTransicionLegal(pedido.Estado, nuevo))
            {
                throw new InvalidOperationException($"Transición ilegal del pedido {pedido.Id}: {pedido.Estado} -> {nuevo}.");
            }

            pedido.HistorialEstados.Add(new HistorialEstadoPedido
            {
                PedidoId = pedido.Id,
                EstadoAnterior = pedido.Estado,
                EstadoNuevo = nuevo,
                UsuarioId = usuarioId,
                CreadoEn = ahora,
            });
            pedido.Estado = nuevo;
        }

        private static ResultadoPedido EstadoInvalido(Pedido pedido, string accion) =>
            ResultadoPedido.Falla(ErrorPedido.EstadoInvalido,
                $"No se puede {accion} el pedido #{pedido.Id} porque está en estado \"{pedido.Estado}\".");

        // Después del commit: un fallo aquí no deshace el cambio de estado, solo se registra.
        private async Task EncolarMensajeAsync(Pedido pedido, PlantillaWhatsapp plantilla)
        {
            try
            {
                var soporte = await db.Configuracion.AsNoTracking()
                    .Where(c => c.Id == 1).Select(c => c.NumeroSoporte).SingleOrDefaultAsync();
                whatsapp.Encolar(pedido, plantilla, soporte);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "No se pudo encolar el WhatsApp {Plantilla} del pedido {PedidoId}.", plantilla, pedido.Id);
            }
        }
    }
}
