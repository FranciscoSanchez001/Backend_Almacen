using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Domain.Entidades
{
    public class Notificacion
    {
        public Guid Id { get; set; }
        public TipoNotificacion Tipo { get; set; }

        // stock_agotado apunta a un producto; pedido_nuevo y pedido_por_expirar a un pedido.
        public Guid? ProductoId { get; set; }
        public Producto? Producto { get; set; }

        public Guid? PedidoId { get; set; }
        public Pedido? Pedido { get; set; }

        public bool Leida { get; set; }
        public DateTime CreadoEn { get; set; }
    }
}
