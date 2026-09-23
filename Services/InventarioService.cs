using Backend_Almacen.Data;
using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Services
{
    // Todos los cambios de stock pasan por aquí. Cada operación es un único UPDATE condicional
    // sobre productos (sin leer antes), así que dos pedidos simultáneos no pueden sobrevender.
    //
    // Los movimientos y notificaciones solo se agregan al contexto: el llamador abre la
    // transacción, llama a SaveChangesAsync y hace commit. Así, por ejemplo, un pedido con varios
    // productos reserva todo o nada.
    //
    // Después de usar este servicio, las entidades Producto que ya estuvieran cargadas en el
    // contexto tienen el stock desactualizado: hay que volver a leerlas.
    public class InventarioService(AlmacenDbContext db)
    {
        // Cliente confirma el pedido: disponible − q, reservado + q.
        // Devuelve false si no alcanza el stock (o el producto no está activo); el llamador
        // debe hacer rollback y avisarle al cliente.
        public async Task<bool> ReservarAsync(int productoId, int cantidad, int pedidoId, int? usuarioId)
        {
            ValidarCantidad(cantidad);
            var disponible = await ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible - {cantidad},
                       stock_reservado  = stock_reservado  + {cantidad}
                 WHERE id = {productoId} AND activo AND stock_disponible >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """);
            if (disponible is null)
            {
                return false;
            }

            RegistrarMovimiento(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Reserva,
                -cantidad, disponible.Value + cantidad, disponible.Value);
            if (disponible == 0)
            {
                NotificarAgotado(productoId);
            }
            return true;
        }

        // Ventas aprueba: reservado − q (la mercancía sale del sistema). El disponible no cambia,
        // así que el movimiento queda con disponible_antes = disponible_despues.
        public async Task ConfirmarVentaAsync(int productoId, int cantidad, int pedidoId, int usuarioId)
        {
            ValidarCantidad(cantidad);
            var disponible = await ActualizarAsync($"""
                UPDATE productos
                   SET stock_reservado = stock_reservado - {cantidad}
                 WHERE id = {productoId} AND stock_reservado >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """) ?? throw ReservaInconsistente(productoId, pedidoId);

            RegistrarMovimiento(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Venta,
                -cantidad, disponible, disponible);
        }

        // Ventas rechaza o el pedido expira: disponible + q (vuelve a la tienda), reservado − q.
        // usuarioId es null cuando lo hace el job de expiración.
        public async Task LiberarAsync(int productoId, int cantidad, int pedidoId, int? usuarioId)
        {
            ValidarCantidad(cantidad);
            var disponible = await ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible + {cantidad},
                       stock_reservado  = stock_reservado  - {cantidad}
                 WHERE id = {productoId} AND stock_reservado >= {cantidad}
                RETURNING stock_disponible AS "Value"
                """) ?? throw ReservaInconsistente(productoId, pedidoId);

            RegistrarMovimiento(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Liberacion,
                cantidad, disponible - cantidad, disponible);
            await ResolverAgotadoSiRepuesto(productoId, disponible - cantidad, disponible);
        }

        // Llegó mercancía: disponible + q. Devuelve el disponible resultante, o null si el
        // producto no existe o está borrado.
        public async Task<int?> ReponerAsync(int productoId, int cantidad, int usuarioId)
        {
            ValidarCantidad(cantidad);
            var disponible = await ActualizarAsync($"""
                UPDATE productos
                   SET stock_disponible = stock_disponible + {cantidad}
                 WHERE id = {productoId} AND activo
                RETURNING stock_disponible AS "Value"
                """);
            if (disponible is null)
            {
                return null;
            }

            RegistrarMovimiento(productoId, null, usuarioId, TipoMovimientoInventario.Reposicion,
                cantidad, disponible.Value - cantidad, disponible.Value);
            await ResolverAgotadoSiRepuesto(productoId, disponible.Value - cantidad, disponible.Value);
            return disponible;
        }

        // Corrección manual del disponible al editar un producto. Solo se aplica si el disponible
        // sigue siendo el que vio el usuario; si entretanto entró o se liberó un pedido devuelve
        // false, para no pisar ese cambio.
        public async Task<bool> AjustarAsync(int productoId, int disponibleEsperado, int disponibleNuevo, int usuarioId)
        {
            if (disponibleNuevo < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(disponibleNuevo));
            }
            ExigirTransaccion();

            var filas = await db.Productos
                .Where(p => p.Id == productoId && p.StockDisponible == disponibleEsperado)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockDisponible, disponibleNuevo));
            if (filas == 0)
            {
                return false;
            }

            RegistrarMovimiento(productoId, null, usuarioId, TipoMovimientoInventario.Ajuste,
                disponibleNuevo - disponibleEsperado, disponibleEsperado, disponibleNuevo);
            if (disponibleNuevo == 0 && disponibleEsperado > 0)
            {
                NotificarAgotado(productoId);
            }
            await ResolverAgotadoSiRepuesto(productoId, disponibleEsperado, disponibleNuevo);
            return true;
        }

        // Stock con el que se crea un producto nuevo (el UPDATE no aplica: la fila se acaba de insertar).
        public void RegistrarStockInicial(int productoId, int cantidad, int usuarioId)
        {
            ValidarCantidad(cantidad);
            RegistrarMovimiento(productoId, null, usuarioId, TipoMovimientoInventario.Reposicion,
                cantidad, 0, cantidad);
        }

        private async Task<int?> ActualizarAsync(FormattableString sql)
        {
            ExigirTransaccion();
            // Sin operadores LINQ encima: EF ejecuta el UPDATE ... RETURNING tal cual.
            var filas = await db.Database.SqlQuery<int>(sql).ToListAsync();
            return filas.Count == 0 ? null : filas[0];
        }

        private void RegistrarMovimiento(int productoId, int? pedidoId, int? usuarioId,
            TipoMovimientoInventario tipo, int cantidad, int disponibleAntes, int disponibleDespues)
        {
            db.MovimientosInventario.Add(new MovimientoInventario
            {
                ProductoId = productoId,
                PedidoId = pedidoId,
                UsuarioId = usuarioId,
                Tipo = tipo,
                Cantidad = cantidad,
                DisponibleAntes = disponibleAntes,
                DisponibleDespues = disponibleDespues,
            });
        }

        private void NotificarAgotado(int productoId)
        {
            db.Notificaciones.Add(new Notificacion { Tipo = TipoNotificacion.StockAgotado, ProductoId = productoId });
        }

        // Si el producto vuelve a tener stock, el aviso de agotado ya no aplica.
        private async Task ResolverAgotadoSiRepuesto(int productoId, int disponibleAntes, int disponibleDespues)
        {
            if (disponibleAntes == 0 && disponibleDespues > 0)
            {
                await db.Notificaciones
                    .Where(n => n.ProductoId == productoId && n.Tipo == TipoNotificacion.StockAgotado && !n.Leida)
                    .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true));
            }
        }

        private void ExigirTransaccion()
        {
            if (db.Database.CurrentTransaction is null)
            {
                throw new InvalidOperationException(
                    "Los cambios de inventario deben hacerse dentro de una transacción.");
            }
        }

        private static void ValidarCantidad(int cantidad)
        {
            if (cantidad <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(cantidad), "La cantidad debe ser mayor a 0.");
            }
        }

        private static InvalidOperationException ReservaInconsistente(int productoId, int pedidoId) =>
            new($"El producto {productoId} no tiene reservadas las unidades del pedido {pedidoId}.");
    }
}
