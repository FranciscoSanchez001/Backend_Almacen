using Backend_Almacen.Application.Abstracciones;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Application.Servicios
{
    // Reglas del inventario sobre las operaciones atómicas de IInventarioRepository: cada
    // movimiento queda registrado, se avisa cuando un producto se agota y el aviso se da por
    // resuelto cuando vuelve a haber stock.
    //
    // Los movimientos y notificaciones solo se agregan: el llamador abre la transacción, guarda y
    // confirma. Así, por ejemplo, un pedido con varios productos reserva todo o nada.
    //
    // Después de usar este servicio, las entidades Producto ya cargadas tienen el stock
    // desactualizado: hay que volver a leerlas.
    public class InventarioService(
        IInventarioRepository inventario,
        INotificacionRepository notificaciones,
        IUnitOfWork unidad)
    {
        // Devuelve false si no alcanza el stock (o el producto no está activo); el llamador debe
        // revertir la transacción y avisarle al cliente.
        public async Task<bool> ReservarAsync(Guid productoId, int cantidad, Guid pedidoId, Guid? usuarioId,
            CancellationToken ct = default)
        {
            Validar(cantidad);
            var disponible = await inventario.ReservarAsync(productoId, cantidad, ct);
            if (disponible is null)
            {
                return false;
            }

            Registrar(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Reserva,
                -cantidad, disponible.Value + cantidad, disponible.Value);
            if (disponible == 0)
            {
                NotificarAgotado(productoId);
            }
            return true;
        }

        // Ventas aprueba: la mercancía sale del sistema. El disponible no cambia, así que el
        // movimiento queda con disponible_antes = disponible_despues.
        public async Task ConfirmarVentaAsync(Guid productoId, int cantidad, Guid pedidoId, Guid usuarioId,
            CancellationToken ct = default)
        {
            Validar(cantidad);
            var disponible = await inventario.ConfirmarVentaAsync(productoId, cantidad, ct)
                ?? throw ReservaInconsistente(productoId, pedidoId);

            Registrar(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Venta,
                -cantidad, disponible, disponible);
        }

        // Ventas rechaza o el pedido expira: las unidades vuelven a la tienda.
        // usuarioId es null cuando lo hace el job de expiración.
        public async Task LiberarAsync(Guid productoId, int cantidad, Guid pedidoId, Guid? usuarioId,
            CancellationToken ct = default)
        {
            Validar(cantidad);
            var disponible = await inventario.LiberarAsync(productoId, cantidad, ct)
                ?? throw ReservaInconsistente(productoId, pedidoId);

            Registrar(productoId, pedidoId, usuarioId, TipoMovimientoInventario.Liberacion,
                cantidad, disponible - cantidad, disponible);
            await ResolverAgotadoSiRepuesto(productoId, disponible - cantidad, disponible, ct);
        }

        // Llegó mercancía. Devuelve el disponible resultante, o null si el producto no existe o
        // está borrado.
        public async Task<int?> ReponerAsync(Guid productoId, int cantidad, Guid usuarioId,
            CancellationToken ct = default)
        {
            Validar(cantidad);
            var disponible = await inventario.ReponerAsync(productoId, cantidad, ct);
            if (disponible is null)
            {
                return null;
            }

            Registrar(productoId, null, usuarioId, TipoMovimientoInventario.Reposicion,
                cantidad, disponible.Value - cantidad, disponible.Value);
            await ResolverAgotadoSiRepuesto(productoId, disponible.Value - cantidad, disponible.Value, ct);
            return disponible;
        }

        // Corrección manual del disponible al editar un producto. Devuelve false si entretanto
        // entró o se liberó un pedido, para no pisar ese cambio.
        public async Task<bool> AjustarAsync(Guid productoId, int disponibleEsperado, int disponibleNuevo, Guid usuarioId,
            CancellationToken ct = default)
        {
            ArgumentOutOfRangeException.ThrowIfNegative(disponibleNuevo);
            ExigirTransaccion();
            if (!await inventario.AjustarAsync(productoId, disponibleEsperado, disponibleNuevo, ct))
            {
                return false;
            }

            Registrar(productoId, null, usuarioId, TipoMovimientoInventario.Ajuste,
                disponibleNuevo - disponibleEsperado, disponibleEsperado, disponibleNuevo);
            if (disponibleNuevo == 0 && disponibleEsperado > 0)
            {
                NotificarAgotado(productoId);
            }
            await ResolverAgotadoSiRepuesto(productoId, disponibleEsperado, disponibleNuevo, ct);
            return true;
        }

        // Stock con el que se crea un producto nuevo.
        public void RegistrarStockInicial(Guid productoId, int cantidad, Guid usuarioId)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(cantidad);
            Registrar(productoId, null, usuarioId, TipoMovimientoInventario.Reposicion, cantidad, 0, cantidad);
        }

        private void Validar(int cantidad)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(cantidad);
            ExigirTransaccion();
        }

        private void ExigirTransaccion()
        {
            if (!unidad.EnTransaccion)
            {
                throw new InvalidOperationException("Los cambios de inventario deben hacerse dentro de una transacción.");
            }
        }

        private void Registrar(Guid productoId, Guid? pedidoId, Guid? usuarioId, TipoMovimientoInventario tipo,
            int cantidad, int disponibleAntes, int disponibleDespues)
        {
            inventario.AgregarMovimiento(new MovimientoInventario
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

        private void NotificarAgotado(Guid productoId) =>
            notificaciones.Agregar(new Notificacion { Tipo = TipoNotificacion.StockAgotado, ProductoId = productoId });

        private async Task ResolverAgotadoSiRepuesto(Guid productoId, int antes, int despues, CancellationToken ct)
        {
            if (antes == 0 && despues > 0)
            {
                await notificaciones.MarcarAgotadoResueltoAsync(productoId, ct);
            }
        }

        private static InvalidOperationException ReservaInconsistente(Guid productoId, Guid pedidoId) =>
            new($"El producto {productoId} no tiene reservadas las unidades del pedido {pedidoId}.");
    }
}
