using System.ComponentModel.DataAnnotations;
using Backend_Almacen.Models;

namespace Backend_Almacen.Dtos
{
    public record CrearProductoRequest(
        [Required, StringLength(200, MinimumLength = 1)] string Nombre,
        [StringLength(2000)] string? Descripcion,
        [Range(0.01, 1_000_000)] decimal PrecioUsd,
        [Url] string? ImagenUrl,
        [Range(1, int.MaxValue)] int CategoriaId,
        [Range(0, 1_000_000)] int StockInicial);

    // StockDisponible es opcional: si viene y es distinto del actual, se registra como ajuste.
    public record ActualizarProductoRequest(
        [Required, StringLength(200, MinimumLength = 1)] string Nombre,
        [StringLength(2000)] string? Descripcion,
        [Range(0.01, 1_000_000)] decimal PrecioUsd,
        [Url] string? ImagenUrl,
        [Range(1, int.MaxValue)] int CategoriaId,
        [Range(0, 1_000_000)] int? StockDisponible);

    // Vista del panel de ventas / superadmin.
    public record ProductoResponse(
        int Id,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal? PrecioBs,
        string? ImagenUrl,
        int CategoriaId,
        string Categoria,
        int StockDisponible,
        int StockReservado,
        bool Activo,
        DateTime CreadoEn,
        DateTime? ActualizadoEn);

    // Vista pública de la tienda.
    public record CatalogoItem(
        int Id,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal? PrecioBs,
        string? ImagenUrl,
        int CategoriaId,
        string Categoria,
        int StockDisponible);

    // Lo que se guarda en auditoria.datos_antes / datos_despues.
    public record ProductoAuditoria(
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        string? ImagenUrl,
        int CategoriaId,
        int StockDisponible,
        bool Activo)
    {
        public static ProductoAuditoria De(Producto p) =>
            new(p.Nombre, p.Descripcion, p.PrecioUsd, p.ImagenUrl, p.CategoriaId, p.StockDisponible, p.Activo);
    }
}
