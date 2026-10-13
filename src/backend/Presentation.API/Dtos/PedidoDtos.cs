using Core.Application.Dtos;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Presentation.API.Dtos
{
    // multipart/form-data, porque trae la captura del pago. Los ítems van como
    // items[0].productoId=..., items[0].cantidad=2, items[1].productoId=...
    // Los datos del pedido y sus reglas están en Core.Application (DatosPedido); aquí solo se
    // agrega el archivo, que es un concepto HTTP.
    public class CrearPedidoForm : DatosPedido
    {
        public IFormFile? Captura { get; set; }
    }

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
        decimal SubtotalBs,
        // Precio sin oferta; igual a PrecioUsd si no la hubo.
        decimal PrecioListaUsd);

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
        List<HistorialEstadoResponse> Historial,
        // Subtotal (ítems con ofertas) − descuento del cupón = total.
        decimal SubtotalUsd,
        decimal SubtotalBs,
        decimal DescuentoUsd,
        decimal DescuentoBs,
        string? CodigoCupon)
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
                i.PrecioUsd, i.PrecioBs, i.PrecioUsd * i.Cantidad, i.PrecioBs * i.Cantidad, i.PrecioListaUsd)).ToList(),
            p.HistorialEstados.OrderBy(h => h.CreatedAt).ThenBy(h => (int)h.EstadoNuevo).Select(h => new HistorialEstadoResponse(
                h.EstadoAnterior, h.EstadoNuevo, Resumen(h.Usuario), h.CreatedAt)).ToList(),
            p.TotalUsd + p.DescuentoUsd, p.TotalBs + p.DescuentoBs, p.DescuentoUsd, p.DescuentoBs, p.Cupon?.Codigo);

        private static UsuarioResumen? Resumen(Usuario? u) => u is null ? null : new(u.Id, u.Nombre, u.Telefono);
    }

    // POST /pedidos/cotizar. StockDisponible permite avisar en el checkout si el carrito pide más
    // de lo que queda. Los montos en Bs van en null mientras no haya tasa del día.
    public record LineaCotizacionResponse(
        Guid ProductoId,
        string Nombre,
        int Cantidad,
        int StockDisponible,
        decimal PrecioUsd,
        decimal PrecioListaUsd,
        decimal SubtotalUsd);

    public record CuponAplicadoResponse(string Codigo, string? Descripcion, TipoCupon Tipo, decimal Valor);

    public record CotizacionResponse(
        List<LineaCotizacionResponse> Lineas,
        decimal SubtotalUsd,
        decimal DescuentoUsd,
        decimal TotalUsd,
        decimal? TasaBsUsd,
        decimal? SubtotalBs,
        decimal? DescuentoBs,
        decimal? TotalBs,
        CuponAplicadoResponse? Cupon)
    {
        public static CotizacionResponse De(Cotizacion c) => new(
            c.Lineas.Select(l => new LineaCotizacionResponse(l.Producto.Id, l.Producto.Nombre, l.Cantidad,
                l.Producto.StockDisponible, l.PrecioUsd, l.PrecioListaUsd, l.SubtotalUsd)).ToList(),
            c.SubtotalUsd, c.DescuentoUsd, c.TotalUsd, c.Tasa, c.SubtotalBs, c.DescuentoBs, c.TotalBs,
            c.Cupon is null ? null : new CuponAplicadoResponse(c.Cupon.Codigo, c.Cupon.Descripcion, c.Cupon.Tipo, c.Cupon.Valor));
    }
}
