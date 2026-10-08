using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    public class HistorialEstadoPedido : BaseEntity
    {
        public Guid PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        // Null en la creación del pedido.
        public EstadoPedido? EstadoAnterior { get; set; }
        public EstadoPedido EstadoNuevo { get; set; }

        // Null si el cambio lo hizo el sistema (p. ej. el job de expiración).
        public Guid? UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

    }
}
