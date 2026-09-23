using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.WebAPI.Dtos
{
    public record ReponerRequest([Range(1, 1_000_000)] int Cantidad);

    public record InventarioItem(
        Guid ProductoId,
        string CodigoSku,
        string Nombre,
        string Categoria,
        int StockDisponible,
        int StockReservado,
        bool Agotado)
    {
        public static InventarioItem De(Producto p) => new(
            p.Id, p.CodigoSku, p.Nombre, p.Categoria.Nombre, p.StockDisponible, p.StockReservado, p.StockDisponible == 0);
    }

    public record MovimientoResponse(
        Guid Id,
        TipoMovimientoInventario Tipo,
        int Cantidad,
        int DisponibleAntes,
        int DisponibleDespues,
        Guid? PedidoId,
        Guid? UsuarioId,
        string? Usuario,
        DateTime CreadoEn)
    {
        public static MovimientoResponse De(MovimientoInventario m) => new(
            m.Id, m.Tipo, m.Cantidad, m.DisponibleAntes, m.DisponibleDespues, m.PedidoId, m.UsuarioId,
            m.Usuario?.Nombre, m.CreadoEn);
    }

    public record NotificacionResponse(
        Guid Id,
        TipoNotificacion Tipo,
        Guid? ProductoId,
        string? Producto,
        Guid? PedidoId,
        bool Leida,
        DateTime CreadoEn)
    {
        public static NotificacionResponse De(Notificacion n) =>
            new(n.Id, n.Tipo, n.ProductoId, n.Producto?.Nombre, n.PedidoId, n.Leida, n.CreadoEn);
    }

    public record CategoriaRequest([Required, StringLength(100, MinimumLength = 1)] string Nombre);

    public record CategoriaResponse(Guid Id, string Nombre)
    {
        public static CategoriaResponse De(Categoria c) => new(c.Id, c.Nombre);
    }

    public record ZonaResponse(Guid Id, string Nombre);
}
