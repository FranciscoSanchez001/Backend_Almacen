using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Domain.Entidades
{
    public class MensajeWhatsapp
    {
        public Guid Id { get; set; }

        public Guid PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        public required string Telefono { get; set; }
        public required string Plantilla { get; set; }
        public required string Texto { get; set; }

        public EstadoMensajeWhatsapp Estado { get; set; }
        public string? Error { get; set; }

        public DateTime CreadoEn { get; set; }
    }
}
