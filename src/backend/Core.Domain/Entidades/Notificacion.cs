using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    public class Notificacion : BaseEntity
    {
        public TipoNotificacion Tipo { get; set; }

        // stock_agotado apunta a un producto; pedido_nuevo y pedido_por_expirar a un pedido.
        public Guid? ProductoId { get; set; }
        public Producto? Producto { get; set; }

        public Guid? PedidoId { get; set; }
        public Pedido? Pedido { get; set; }

        public bool Leida { get; set; }
    }
}
