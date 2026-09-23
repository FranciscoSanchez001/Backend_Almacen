using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Domain.Entidades
{
    public class MovimientoInventario
    {
        public Guid Id { get; set; }

        public Guid ProductoId { get; set; }
        public Producto Producto { get; set; } = null!;

        public Guid? PedidoId { get; set; }
        public Pedido? Pedido { get; set; }

        // Null si el movimiento lo hizo el sistema.
        public Guid? UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

        public TipoMovimientoInventario Tipo { get; set; }

        // Positivo o negativo.
        public int Cantidad { get; set; }
        public int DisponibleAntes { get; set; }
        public int DisponibleDespues { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
