using Core.Domain.Enums;

namespace Core.Application.Modelos
{
    // Estado del servicio de WhatsApp tal como lo ve el gerente.
    //   Configurado: la API tiene la URL del servicio (Whatsapp:ServicioUrl).
    //   Disponible:  el servicio respondió.
    //   Estado:      desconectado | conectando | esperando_qr | conectado.
    //   Qr:          imagen del código (data:image/png;base64,...) mientras Estado = esperando_qr.
    //   Numero:      teléfono vinculado, sin "+".
    public record EstadoWhatsapp(
        bool Configurado,
        bool Disponible,
        string Estado,
        string? Qr,
        string? Numero,
        string? Nombre,
        string? Mensaje);

    // Últimos mensajes registrados en mensajes_whatsapp, para revisar qué se envió y qué no.
    public record MensajeWhatsappRegistrado(
        Guid Id,
        int NumeroPedido,
        string Telefono,
        string Plantilla,
        string Texto,
        EstadoMensajeWhatsapp Estado,
        string? Error,
        DateTime CreadoEn);
}
