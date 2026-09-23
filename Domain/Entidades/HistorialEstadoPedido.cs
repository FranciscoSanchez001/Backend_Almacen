using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Domain.Entidades
{
    public class HistorialEstadoPedido
    {
        public Guid Id { get; set; }

        public Guid PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        // Null en la creación del pedido.
        public EstadoPedido? EstadoAnterior { get; set; }
        public EstadoPedido EstadoNuevo { get; set; }

        // Null si el cambio lo hizo el sistema (p. ej. el job de expiración).
        public Guid? UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
