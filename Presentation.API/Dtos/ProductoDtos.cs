using System.ComponentModel.DataAnnotations;
using Core.Application.Servicios;
using Core.Domain.Entidades;

namespace Presentation.API.Dtos
{
    public record CrearProductoRequest(
        [Required, StringLength(30, MinimumLength = 1)] string CodigoSku,
        [Required, StringLength(200, MinimumLength = 1)] string Nombre,
        [StringLength(1000)] string? Descripcion,
        [Range(0.01, 1_000_000)] decimal PrecioUsd,
        [Range(0, 1_000_000)] decimal CostoUsd,
        [Url, StringLength(500)] string? ImagenUrl,
        Guid CategoriaId,
        [Range(0, 1_000_000)] int StockInicial);

    // StockDisponible es opcional: si viene y es distinto del actual, se registra como ajuste.
    public record ActualizarProductoRequest(
        [Required, StringLength(30, MinimumLength = 1)] string CodigoSku,
        [Required, StringLength(200, MinimumLength = 1)] string Nombre,
        [StringLength(1000)] string? Descripcion,
        [Range(0.01, 1_000_000)] decimal PrecioUsd,
        [Range(0, 1_000_000)] decimal CostoUsd,
        [Url, StringLength(500)] string? ImagenUrl,
        Guid CategoriaId,
        [Range(0, 1_000_000)] int? StockDisponible);

    // Vista del panel de ventas / superadmin.
    public record ProductoResponse(
        Guid Id,
        string CodigoSku,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal? PrecioBs,
        decimal CostoUsd,
        string? ImagenUrl,
        Guid CategoriaId,
        string Categoria,
        int StockDisponible,
        int StockReservado,
        bool Activo,
        DateTime CreadoEn,
        DateTime? ActualizadoEn)
    {
        // El producto debe traer la categoría cargada.
        public static ProductoResponse De(Producto p, decimal? tasa) => new(
            p.Id, p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, TasaService.EnBs(p.PrecioUsd, tasa), p.CostoUsd,
            p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre, p.StockDisponible, p.StockReservado, p.Activo,
            p.CreatedAt, p.ActualizadoEn);
    }

    // Vista pública de la tienda (sin costo ni stock reservado).
    public record CatalogoItem(
        Guid Id,
        string CodigoSku,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal? PrecioBs,
        string? ImagenUrl,
        Guid CategoriaId,
        string Categoria,
        int StockDisponible)
    {
        public static CatalogoItem De(Producto p, decimal? tasa) => new(
            p.Id, p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, TasaService.EnBs(p.PrecioUsd, tasa),
            p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre, p.StockDisponible);
    }

    // Inicio de la tienda. Las listas personales van vacías si no hay un cliente con sesión.
    public record InicioTiendaResponse(
        IReadOnlyList<CatalogoItem> MasVendidos,
        IReadOnlyList<CatalogoItem> CompraSiempre,
        IReadOnlyList<CatalogoItem> UltimasCompras);

    // Paso 1 del checkout: datos para pagar. Transferencia y pago móvil se pagan en Bs con la
    // tasa del día; Binance en USDT 1:1.
    public record DatosPagoResponse(
        decimal? TasaBsUsd,
        string? DatosTransferencia,
        string? DatosPagoMovil,
        string? WalletBinance,
        string? NumeroSoporte)
    {
        public static DatosPagoResponse De(Configuracion c) =>
            new(c.TasaBsUsd, c.DatosTransferencia, c.DatosPagoMovil, c.WalletBinance, c.NumeroSoporte);
    }

    // Lo que se guarda en auditoria.datos_antes / datos_despues.
    public record ProductoAuditoria(
        string CodigoSku,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal CostoUsd,
        string? ImagenUrl,
        Guid CategoriaId,
        int StockDisponible,
        bool Activo)
    {
        public static ProductoAuditoria De(Producto p) =>
            new(p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, p.CostoUsd, p.ImagenUrl, p.CategoriaId,
                p.StockDisponible, p.Activo);
    }
}
