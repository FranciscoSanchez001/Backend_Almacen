namespace Backend_Almacen.Domain.Entidades
{
    public class Producto
    {
        public Guid Id { get; set; }

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

        // Borrado lógico.
        public bool Activo { get; set; } = true;

        public Guid? CreadoPorId { get; set; }
        public Usuario? CreadoPor { get; set; }

        public DateTime CreadoEn { get; set; }
        public DateTime? ActualizadoEn { get; set; }
    }
}
