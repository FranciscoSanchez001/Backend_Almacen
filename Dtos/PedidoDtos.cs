using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Models;

namespace Backend_Almacen.Dtos
{
    // multipart/form-data, porque trae la captura del pago. Los ítems van como
    // items[0].productoId=1, items[0].cantidad=2, items[1].productoId=...
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

        [Range(1, int.MaxValue)]
        public int ZonaId { get; set; }

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

    public record ItemPedidoRequest([Range(1, int.MaxValue)] int ProductoId, [Range(1, 1000)] int Cantidad);

    public record AprobarPedidoRequest([Range(1, int.MaxValue)] int RepartidorId);

    // Sin motivo se usa "el método de pago no procede".
    public record RechazarPedidoRequest([StringLength(300)] string? Motivo);

    public record UsuarioResumen(int Id, string Nombre, string? Telefono);

    public record ClienteResumen(int Id, string Nombre, string Email, string? Telefono);

    public record ZonaResumen(int Id, string Nombre);

    public record PedidoItemResponse(
        int ProductoId,
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
        int Id,
        EstadoPedido Estado,
        ClienteResumen Cliente,
        MetodoPago MetodoPago,
        MonedaPago MonedaPago,
        decimal TasaCambio,
        decimal TotalUsd,
        decimal TotalBs,
        string? ReferenciaPago,
        string? CapturaUrl,
        ZonaResumen Zona,
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
        // El pedido debe venir con Cliente, Zona, RevisadoPor, Repartidor, Items (Producto,
        // Categoria) e HistorialEstados (Usuario) cargados.
        public static PedidoResponse De(Pedido p) => new(
            p.Id, p.Estado,
            new ClienteResumen(p.Cliente.Id, p.Cliente.Nombre, p.Cliente.Email, p.Cliente.Telefono),
            p.MetodoPago, p.MonedaPago, p.TasaCambio, p.TotalUsd, p.TotalBs,
            p.ReferenciaPago, p.CapturaUrl,
            new ZonaResumen(p.Zona.Id, p.Zona.Nombre),
            p.DireccionTexto, p.Latitud, p.Longitud, p.TelefonoContacto,
            Resumen(p.RevisadoPor), p.RevisadoEn, p.MotivoRechazo,
            Resumen(p.Repartidor), p.AsignadoEn, p.EnCaminoEn, p.EntregadoEn,
            p.ExpiraEn, p.CreadoEn,
            p.Items.OrderBy(i => i.Id).Select(i => new PedidoItemResponse(
                i.ProductoId, i.Producto.Nombre, i.Categoria.Nombre, i.Cantidad,
                i.PrecioUsd, i.PrecioBs, i.PrecioUsd * i.Cantidad, i.PrecioBs * i.Cantidad)).ToList(),
            p.HistorialEstados.OrderBy(h => h.CreadoEn).ThenBy(h => h.Id).Select(h => new HistorialEstadoResponse(
                h.EstadoAnterior, h.EstadoNuevo, Resumen(h.Usuario), h.CreadoEn)).ToList());

        private static UsuarioResumen? Resumen(Usuario? u) => u is null ? null : new(u.Id, u.Nombre, u.Telefono);
    }

    public record ClienteListado(
        int Id,
        string Nombre,
        string Email,
        string? Telefono,
        bool Activo,
        int Pedidos,
        DateTime? UltimoPedido);

    public record RepartidorDisponible(int Id, string Nombre, string? Telefono, int PedidosEnCurso);
}
