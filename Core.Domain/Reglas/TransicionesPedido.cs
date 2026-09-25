using Core.Domain.Enums;

namespace Core.Domain.Reglas
{
    // Cambios de estado legales de un pedido. Aprobar pasa por "aprobado" y "asignado" en la
    // misma operación, porque no se puede aprobar sin elegir repartidor.
    public static class TransicionesPedido
    {
        private static readonly Dictionary<EstadoPedido, EstadoPedido[]> Legales = new()
        {
            [EstadoPedido.Pendiente] = [EstadoPedido.Aprobado, EstadoPedido.Rechazado, EstadoPedido.Expirado],
            [EstadoPedido.Aprobado] = [EstadoPedido.Asignado],
            [EstadoPedido.Asignado] = [EstadoPedido.EnCamino],
            [EstadoPedido.EnCamino] = [EstadoPedido.Entregado],
        };

        public static bool EsLegal(EstadoPedido desde, EstadoPedido hacia) =>
            Legales.TryGetValue(desde, out var destinos) && destinos.Contains(hacia);

        // Estados que cuentan como venta (KPIs e informes).
        public static readonly EstadoPedido[] CuentanComoVenta =
            [EstadoPedido.Aprobado, EstadoPedido.Asignado, EstadoPedido.EnCamino, EstadoPedido.Entregado];
    }
}
