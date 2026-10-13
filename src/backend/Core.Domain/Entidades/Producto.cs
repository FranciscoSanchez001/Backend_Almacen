using Core.Domain.Comun;
using Core.Domain.Reglas;

namespace Core.Domain.Entidades
{
    public class Producto : BaseEntity
    {
        // Código interno único del producto (p. ej. VIV-0001).
        public required string CodigoSku { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }

        // Precio de venta y costo de compra, en USD.
        public decimal PrecioUsd { get; set; }
        public decimal CostoUsd { get; set; }
        public string? ImagenUrl { get; set; }

        public Guid CategoriaId { get; set; }
        public Categoria Categoria { get; set; } = null!;

        public int StockDisponible { get; set; }
        public int StockReservado { get; set; }

        // Límites de reposición: por debajo del mínimo hay que reponer; el máximo es la capacidad
        // de almacenamiento. Siempre StockMaximo > StockMinimo.
        public int StockMinimo { get; set; } = ValoresPorDefecto.StockMinimo;
        public int StockMaximo { get; set; } = ValoresPorDefecto.StockMaximo;

        // Pasillo/estante del almacén (p. ej. "P3-E2") y unidad de venta (unidad, kg, litro, paquete...).
        public string? Ubicacion { get; set; }
        public string UnidadMedida { get; set; } = ValoresPorDefecto.UnidadMedida;

        // Oferta: % de descuento sobre PrecioUsd, vigente en [DescuentoDesde, DescuentoHasta).
        // Sin fechas, la oferta aplica mientras tenga porcentaje.
        public decimal? DescuentoPorcentaje { get; set; }
        public DateTime? DescuentoDesde { get; set; }
        public DateTime? DescuentoHasta { get; set; }

        // Borrado lógico.
        public bool Activo { get; set; } = true;

        public Guid? CreadoPorId { get; set; }
        public Usuario? CreadoPor { get; set; }

        public DateTime? ActualizadoEn { get; set; }

        public bool TieneOfertaVigente(DateTime ahora) =>
            DescuentoPorcentaje is > 0 && Descuentos.EstaVigente(DescuentoDesde, DescuentoHasta, ahora);

        // Precio de venta en este momento: con la oferta aplicada si está vigente.
        public decimal PrecioVigenteUsd(DateTime ahora) =>
            TieneOfertaVigente(ahora) ? Descuentos.AplicarPorcentaje(PrecioUsd, DescuentoPorcentaje!.Value) : PrecioUsd;

        // Los usa también la configuración de EF (HasDefaultValue) para que la base tenga los mismos.
        public static class ValoresPorDefecto
        {
            public const int StockMinimo = 5;
            public const int StockMaximo = 100;
            public const string UnidadMedida = "unidad";
        }
    }
}
