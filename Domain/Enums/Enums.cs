using System.Text.Json.Serialization;

namespace Backend_Almacen.Domain.Enums
{
    // Se guardan como enums nativos de PostgreSQL; Infrastructure los traduce a snake_case
    // (EnCamino -> en_camino). MonedaPago es la excepción: VES y USDT van en mayúsculas.

    public enum RolUsuario
    {
        Cliente,
        Ventas,
        Repartidor,
        Superadmin
    }

    public enum EstadoPedido
    {
        Pendiente,
        Aprobado,
        Rechazado,
        Expirado,
        Asignado,
        EnCamino,
        Entregado
    }

    public enum MetodoPago
    {
        Transferencia,
        PagoMovil,
        Binance
    }

    public enum MonedaPago
    {
        [JsonStringEnumMemberName("VES")] Ves,
        [JsonStringEnumMemberName("USDT")] Usdt
    }

    public enum TipoMovimientoInventario
    {
        Reserva,
        Venta,
        Liberacion,
        Reposicion,
        Ajuste
    }

    public enum AccionAuditoria
    {
        Crear,
        Editar,
        Borrar,
        DescargarReporte
    }

    public enum TipoNotificacion
    {
        StockAgotado,
        PedidoNuevo,
        PedidoPorExpirar
    }

    public enum EstadoMensajeWhatsapp
    {
        Enviado,
        Error,
        BloqueadoListaBlanca
    }
}
