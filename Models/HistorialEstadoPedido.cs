namespace Backend_Almacen.Models
{
    public class HistorialEstadoPedido
    {
        public int Id { get; set; }

        public int PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        // Null en la creación del pedido.
        public EstadoPedido? EstadoAnterior { get; set; }
        public EstadoPedido EstadoNuevo { get; set; }

        // Null si el cambio lo hizo el sistema (p. ej. el job de expiración).
        public int? UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
