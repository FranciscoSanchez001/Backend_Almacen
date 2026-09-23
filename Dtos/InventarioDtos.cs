using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Models;

namespace Backend_Almacen.Dtos
{
    public record ReponerRequest([Range(1, 1_000_000)] int Cantidad);

    public record InventarioItem(
        int ProductoId,
        string Nombre,
        string Categoria,
        int StockDisponible,
        int StockReservado,
        bool Agotado);

    public record MovimientoResponse(
        int Id,
        TipoMovimientoInventario Tipo,
        int Cantidad,
        int DisponibleAntes,
        int DisponibleDespues,
        int? PedidoId,
        int? UsuarioId,
        string? Usuario,
        DateTime CreadoEn);

    public record NotificacionResponse(
        int Id,
        TipoNotificacion Tipo,
        int? ProductoId,
        string? Producto,
        int? PedidoId,
        bool Leida,
        DateTime CreadoEn);

    public record CategoriaRequest([Required, StringLength(100, MinimumLength = 1)] string Nombre);
}
