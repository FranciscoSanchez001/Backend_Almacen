using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    public class MovimientoInventario : BaseEntity
    {
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

    }
}
