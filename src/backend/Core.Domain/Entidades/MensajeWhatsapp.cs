using Core.Domain.Comun;
using Core.Domain.Enums;

namespace Core.Domain.Entidades
{
    public class MensajeWhatsapp : BaseEntity
    {
        public Guid PedidoId { get; set; }
        public Pedido Pedido { get; set; } = null!;

        public required string Telefono { get; set; }
        public required string Plantilla { get; set; }
        public required string Texto { get; set; }

        public EstadoMensajeWhatsapp Estado { get; set; }
        public string? Error { get; set; }

    }
}
