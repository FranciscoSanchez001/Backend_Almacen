namespace Backend_Almacen.Models
{
    public class MensajeWhatsapp
    {
        public int Id { get; set; }

        public int PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        public required string Telefono { get; set; }
        public required string Plantilla { get; set; }
        public required string Texto { get; set; }

        public EstadoMensajeWhatsapp Estado { get; set; }
        public string? Error { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
