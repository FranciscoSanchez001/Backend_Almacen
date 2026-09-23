namespace Backend_Almacen.Domain.Entidades
{
    public class PedidoItem
    {
        public Guid Id { get; set; }

        public Guid PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        public Guid ProductoId { get; set; }
        public Producto Producto { get; set; } = null!;

        // Congelada: si el producto cambia de categoría, la venta sigue contando en la original.
        public Guid CategoriaId { get; set; }
        public Categoria Categoria { get; set; } = null!;

        public int Cantidad { get; set; }

        // Precios congelados al momento de la compra.
        public decimal PrecioUsd { get; set; }
        public decimal PrecioBs { get; set; }
    }
}
