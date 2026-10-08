using Core.Application.Modelos;

namespace Core.Application.Abstracciones
{
    // Arma el .xlsx del informe de ventas con las 10 hojas de la especificación.
    public interface IGeneradorExcel
    {
        byte[] Generar(DatosReporte datos);
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
