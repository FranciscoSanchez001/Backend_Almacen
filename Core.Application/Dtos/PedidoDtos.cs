using Core.Domain.Enums;

namespace Core.Application.Dtos
{
    // Datos del pedido que arma el cliente en el checkout. El formulario multipart de la API
    // (CrearPedidoForm) hereda de aquí y solo agrega la captura del pago, que es un archivo HTTP.
    public class DatosPedido
    {
        public List<ItemPedidoRequest> Items { get; set; } = [];

        // transferencia | pago_movil | binance
        public string MetodoPago { get; set; } = "";

        public string ReferenciaPago { get; set; } = "";

        public Guid ZonaId { get; set; }

        // Dirección más el texto de referencia ("casa azul frente a la panadería").
        public string DireccionTexto { get; set; } = "";

        public double? Latitud { get; set; }

        public double? Longitud { get; set; }

        // +58 4XX XXX XXXX
        public string Telefono { get; set; } = "";

        public static MetodoPago? ParsearMetodoPago(string? valor) => valor?.Trim().ToLowerInvariant() switch
        {
            "transferencia" => Domain.Enums.MetodoPago.Transferencia,
            "pago_movil" => Domain.Enums.MetodoPago.PagoMovil,
            "binance" => Domain.Enums.MetodoPago.Binance,
            _ => null,
        };
    }

    public record ItemPedidoRequest(Guid ProductoId, int Cantidad);

    public record AprobarPedidoRequest(Guid RepartidorId);

    // Sin motivo se usa "el método de pago no procede".
    public record RechazarPedidoRequest(string? Motivo);
}
