using System.ComponentModel.DataAnnotations;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Presentation.API.Dtos
{
    // multipart/form-data, porque trae la captura del pago. Los ítems van como
    // items[0].productoId=..., items[0].cantidad=2, items[1].productoId=...
    public class CrearPedidoForm
    {
        [Required, MinLength(1, ErrorMessage = "El pedido debe tener al menos un producto."), MaxLength(50)]
        public List<ItemPedidoRequest> Items { get; set; } = [];

        // transferencia | pago_movil | binance
        [Required]
        public string MetodoPago { get; set; } = "";

        [Required, StringLength(100, MinimumLength = 1)]
        public string ReferenciaPago { get; set; } = "";

        [Required]
        public IFormFile? Captura { get; set; }

        public Guid ZonaId { get; set; }

        // Dirección más el texto de referencia ("casa azul frente a la panadería").
        [Required, StringLength(500, MinimumLength = 5)]
        public string DireccionTexto { get; set; } = "";

        [Range(-90, 90)]
        public double? Latitud { get; set; }

        [Range(-180, 180)]
        public double? Longitud { get; set; }

        // +58 4XX XXX XXXX
        [Required]
        public string Telefono { get; set; } = "";
    }

    public record ItemPedidoRequest(Guid ProductoId, [Range(1, 1000)] int Cantidad);

    public record AprobarPedidoRequest(Guid RepartidorId);

    // Sin motivo se usa "el método de pago no procede".
    public record RechazarPedidoRequest([StringLength(300)] string? Motivo);

    public record UsuarioResumen(Guid Id, string Nombre, string? Telefono);

    public record ClienteResumen(Guid Id, string Nombre, string Email, string? Telefono);

    public record PedidoItemResponse(
        Guid ProductoId,
        string CodigoSku,
        string Producto,
        string Categoria,
        int Cantidad,
        decimal PrecioUsd,
        decimal PrecioBs,
        decimal SubtotalUsd,
        decimal SubtotalBs);

    // Usuario null: lo hizo el sistema (job de expiración).
    public record HistorialEstadoResponse(
        EstadoPedido? EstadoAnterior,
        EstadoPedido EstadoNuevo,
        UsuarioResumen? Usuario,
        DateTime CreadoEn);

    public record PedidoResponse(
        Guid Id,
        int Numero,
        EstadoPedido Estado,
        ClienteResumen Cliente,
        MetodoPago MetodoPago,
        MonedaPago MonedaPago,
        decimal TasaCambio,
        decimal TotalUsd,
        decimal TotalBs,
        string? ReferenciaPago,
        string? CapturaUrl,
        ZonaResponse Zona,
        string DireccionTexto,
        double? Latitud,
        double? Longitud,
        string TelefonoContacto,
        UsuarioResumen? RevisadoPor,
        DateTime? RevisadoEn,
        string? MotivoRechazo,
        UsuarioResumen? Repartidor,
        DateTime? AsignadoEn,
        DateTime? EnCaminoEn,
        DateTime? EntregadoEn,
        DateTime ExpiraEn,
        DateTime CreadoEn,
        List<PedidoItemResponse> Items,
        List<HistorialEstadoResponse> Historial)
    {
        // El pedido debe venir de IPedidoRepository.ObtenerDetalleAsync / ListarAsync.
        public static PedidoResponse De(Pedido p) => new(
            p.Id, p.Numero, p.Estado,
            new ClienteResumen(p.Cliente.Id, p.Cliente.Nombre, p.Cliente.Email, p.Cliente.Telefono),
            p.MetodoPago, p.MonedaPago, p.TasaCambio, p.TotalUsd, p.TotalBs,
            p.ReferenciaPago, p.CapturaUrl,
            new ZonaResponse(p.Zona.Id, p.Zona.Nombre),
            p.DireccionTexto, p.Latitud, p.Longitud, p.TelefonoContacto,
            Resumen(p.RevisadoPor), p.RevisadoEn, p.MotivoRechazo,
            Resumen(p.Repartidor), p.AsignadoEn, p.EnCaminoEn, p.EntregadoEn,
            p.ExpiraEn, p.CreatedAt,
            p.Items.OrderBy(i => i.Producto.Nombre).Select(i => new PedidoItemResponse(
                i.ProductoId, i.Producto.CodigoSku, i.Producto.Nombre, i.Categoria.Nombre, i.Cantidad,
                i.PrecioUsd, i.PrecioBs, i.PrecioUsd * i.Cantidad, i.PrecioBs * i.Cantidad)).ToList(),
            p.HistorialEstados.OrderBy(h => h.CreatedAt).ThenBy(h => (int)h.EstadoNuevo).Select(h => new HistorialEstadoResponse(
                h.EstadoAnterior, h.EstadoNuevo, Resumen(h.Usuario), h.CreatedAt)).ToList());

        private static UsuarioResumen? Resumen(Usuario? u) => u is null ? null : new(u.Id, u.Nombre, u.Telefono);
    }
}
