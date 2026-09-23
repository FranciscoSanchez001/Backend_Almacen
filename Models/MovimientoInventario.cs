namespace Backend_Almacen.Models
{
    public class MovimientoInventario
    {
        public int Id { get; set; }

        public int ProductoId { get; set; }
        public Producto Producto { get; set; } = null!;

        public int? PedidoId { get; set; }
        public Pedido? Pedido { get; set; }

        // Null si el movimiento lo hizo el sistema.
        public int? UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

        public TipoMovimientoInventario Tipo { get; set; }

        // Positivo o negativo.
        public int Cantidad { get; set; }
        public int DisponibleAntes { get; set; }
        public int DisponibleDespues { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
