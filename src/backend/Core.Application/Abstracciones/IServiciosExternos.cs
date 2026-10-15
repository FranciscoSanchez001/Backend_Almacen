using Core.Application.Modelos;

namespace Core.Application.Abstracciones
{
    // Arma el .xlsx del informe de ventas con las 10 hojas de la especificación.
    public interface IGeneradorExcel
    {
        byte[] Generar(DatosReporte datos);
    }

    // Arma el PDF del dashboard KPI: los mismos indicadores que se ven en pantalla, incluido el
    // comportamiento de los visitantes, con formato para imprimir o compartir.
    public interface IGeneradorPdf
    {
        byte[] Generar(Kpis kpis, Comportamiento comportamiento);
    }

    // Sesión del servicio de WhatsApp (Baileys) para la pantalla Administración > WhatsApp:
    // ver el estado y el QR, vincular o desvincular el teléfono y enviar un mensaje de prueba.
    public interface IClienteWhatsapp
    {
        Task<EstadoWhatsapp> EstadoAsync(CancellationToken ct = default);
        Task<EstadoWhatsapp> VincularAsync(CancellationToken ct = default);
        Task<EstadoWhatsapp> DesvincularAsync(CancellationToken ct = default);

        // null si se envió; si no, el motivo para mostrarlo al gerente.
        Task<string?> EnviarAsync(string telefono, string texto, CancellationToken ct = default);
    }

    // Dónde se guardan las capturas de pago (Cloudinary o disco local).
    public interface IAlmacenamientoArchivos
    {
        // Devuelve la URL con la que se podrá ver el archivo.
        Task<string> GuardarAsync(Stream contenido, string nombreArchivo, string carpeta, CancellationToken ct = default);

        // Best effort: se usa para limpiar si el pedido no llegó a crearse.
        Task EliminarAsync(string url);
    }

    public interface IHasherContrasenas
    {
        string Hash(string contrasena);
        bool Verificar(string contrasena, string hash);
    }
}
