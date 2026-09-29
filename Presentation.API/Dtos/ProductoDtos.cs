using Core.Application.Servicios;
using Core.Domain.Entidades;

namespace Presentation.API.Dtos
{
    // Los DTOs de entrada (creación/edición) están en Core.Application.Dtos junto a sus validadores.

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
        int StockMinimo,
        int StockMaximo,
        bool BajoStockMinimo,
        string? Ubicacion,
        string UnidadMedida,
        bool Activo,
        DateTime CreadoEn,
        DateTime? ActualizadoEn)
    {
        // El producto debe traer la categoría cargada.
        public static ProductoResponse De(Producto p, decimal? tasa) => new(
            p.Id, p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, TasaService.EnBs(p.PrecioUsd, tasa), p.CostoUsd,
            p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre, p.StockDisponible, p.StockReservado,
            p.StockMinimo, p.StockMaximo, p.StockDisponible < p.StockMinimo, p.Ubicacion, p.UnidadMedida, p.Activo,
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
        int StockDisponible,
        string UnidadMedida)
    {
        public static CatalogoItem De(Producto p, decimal? tasa) => new(
            p.Id, p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, TasaService.EnBs(p.PrecioUsd, tasa),
            p.ImagenUrl, p.CategoriaId, p.Categoria.Nombre, p.StockDisponible, p.UnidadMedida);
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
}
