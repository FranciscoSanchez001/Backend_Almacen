using Core.Domain.Entidades;

namespace Core.Application.Dtos
{
    // Las reglas de cada DTO están en Validadores/ (FluentValidation); aquí solo la forma de los datos.

    // Campos comunes a la creación y la edición: DatosProductoValidator los valida una sola vez.
    public interface IDatosProducto
    {
        string CodigoSku { get; }
        string Nombre { get; }
        string? Descripcion { get; }
        decimal PrecioUsd { get; }
        decimal CostoUsd { get; }
        string? ImagenUrl { get; }
        Guid CategoriaId { get; }
        int StockMinimo { get; }
        int StockMaximo { get; }
        string? Ubicacion { get; }
        string UnidadMedida { get; }
    }

    public record CrearProductoRequest(
        string CodigoSku,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal CostoUsd,
        string? ImagenUrl,
        Guid CategoriaId,
        int StockInicial,
        int StockMinimo = Producto.ValoresPorDefecto.StockMinimo,
        int StockMaximo = Producto.ValoresPorDefecto.StockMaximo,
        string? Ubicacion = null,
        string UnidadMedida = Producto.ValoresPorDefecto.UnidadMedida) : IDatosProducto;

    // StockDisponible es opcional: si viene y es distinto del actual, se registra como ajuste.
    public record ActualizarProductoRequest(
        string CodigoSku,
        string Nombre,
        string? Descripcion,
        decimal PrecioUsd,
        decimal CostoUsd,
        string? ImagenUrl,
        Guid CategoriaId,
        int? StockDisponible,
        int StockMinimo = Producto.ValoresPorDefecto.StockMinimo,
        int StockMaximo = Producto.ValoresPorDefecto.StockMaximo,
        string? Ubicacion = null,
        string UnidadMedida = Producto.ValoresPorDefecto.UnidadMedida) : IDatosProducto;

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
        int StockMinimo,
        int StockMaximo,
        string? Ubicacion,
        string UnidadMedida,
        bool Activo)
    {
        public static ProductoAuditoria De(Producto p) =>
            new(p.CodigoSku, p.Nombre, p.Descripcion, p.PrecioUsd, p.CostoUsd, p.ImagenUrl, p.CategoriaId,
                p.StockDisponible, p.StockMinimo, p.StockMaximo, p.Ubicacion, p.UnidadMedida, p.Activo);
    }
}
