namespace Backend_Almacen.Models
{
    public class Producto
    {
        public int Id { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public decimal PrecioUsd { get; set; }
        public string? ImagenUrl { get; set; }

        public int CategoriaId { get; set; }
        public Categoria Categoria { get; set; } = null!;

        public int StockDisponible { get; set; }
        public int StockReservado { get; set; }

        // Borrado lógico.
        public bool Activo { get; set; } = true;

        public int? CreadoPorId { get; set; }
        public Usuario? CreadoPor { get; set; }

        public DateTime CreadoEn { get; set; }
        public DateTime? ActualizadoEn { get; set; }
    }
}
