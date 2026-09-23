namespace Backend_Almacen.Models
{
    public class Notificacion
    {
        public int Id { get; set; }
        public TipoNotificacion Tipo { get; set; }

        // stock_agotado apunta a un producto; pedido_nuevo y pedido_por_expirar a un pedido.
        public int? ProductoId { get; set; }
        public Producto? Producto { get; set; }

        public int? PedidoId { get; set; }
        public Pedido? Pedido { get; set; }

        public bool Leida { get; set; }
        public DateTime CreadoEn { get; set; }
    }
}
