using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace Backend_Almacen.Models
{
    // Se guardan como enums nativos de PostgreSQL; Npgsql traduce los nombres a snake_case
    // (EnCamino -> en_camino) salvo que se indique otro con [PgName].

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
        [PgName("VES"), JsonStringEnumMemberName("VES")] Ves,
        [PgName("USDT"), JsonStringEnumMemberName("USDT")] Usdt
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
