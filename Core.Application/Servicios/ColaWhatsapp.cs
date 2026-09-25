using System.Globalization;
using System.Threading.Channels;
using Core.Domain.Entidades;

namespace Core.Application.Servicios
{
    public enum PlantillaWhatsapp
    {
        Aprobado,
        Rechazado,
        Expirado,
        EnCamino,
        Entregado
    }

    public record MensajeEnCola(Guid PedidoId, string Telefono, PlantillaWhatsapp Plantilla, string Texto);

    // Los mensajes se encolan después del commit y los envía un worker de Infrastructure en
    // segundo plano, para que aprobar o rechazar no espere al servicio de WhatsApp ni falle si
    // está caído.
    public class ColaWhatsapp
    {
        private readonly Channel<MensajeEnCola> canal = Channel.CreateUnbounded<MensajeEnCola>();

        public ChannelReader<MensajeEnCola> Lector => canal.Reader;

        // El pedido debe traer cargados Cliente y Zona.
        public void Encolar(Pedido pedido, PlantillaWhatsapp plantilla, string? soporte)
        {
            var texto = Armar(pedido, plantilla, soporte ?? "número de soporte");
            canal.Writer.TryWrite(new MensajeEnCola(pedido.Id, pedido.TelefonoContacto, plantilla, texto));
        }

        public static string Armar(Pedido p, PlantillaWhatsapp plantilla, string soporte) => plantilla switch
        {
            PlantillaWhatsapp.Aprobado =>
                $"¡Hola {p.Cliente.Nombre}! Tu compra #{p.Numero} por ${Monto(p.TotalUsd)} (Bs {Monto(p.TotalBs)}) " +
                $"fue aprobada y será enviada a: {p.DireccionTexto}, {p.Zona.Nombre}.",
            PlantillaWhatsapp.Rechazado =>
                $"Hola {p.Cliente.Nombre}, tu compra #{p.Numero} fue rechazada porque {p.MotivoRechazo}. " +
                $"Si crees que es un error, escríbenos al {soporte}.",
            PlantillaWhatsapp.Expirado =>
                $"Hola {p.Cliente.Nombre}, tu pedido #{p.Numero} no pudo ser procesado a tiempo y fue cancelado. " +
                $"Si ya realizaste el pago, comunícate al {soporte}.",
            PlantillaWhatsapp.EnCamino =>
                $"Tu pedido #{p.Numero} ya va en camino.",
            PlantillaWhatsapp.Entregado =>
                $"Tu pedido #{p.Numero} fue entregado. Si no llegó o no llegó en buen estado, comunícate al {soporte}.",
            _ => throw new ArgumentOutOfRangeException(nameof(plantilla)),
        };

        // Formato venezolano: 1.234,56 (sin depender de la cultura instalada en el servidor).
        public static string Monto(decimal valor) =>
            valor.ToString("#,##0.00", CultureInfo.InvariantCulture)
                .Replace(',', '_').Replace('.', ',').Replace('_', '.');

        public static string Nombre(PlantillaWhatsapp plantilla) => plantilla switch
        {
            PlantillaWhatsapp.EnCamino => "en_camino",
            _ => plantilla.ToString().ToLowerInvariant(),
        };
    }
}
