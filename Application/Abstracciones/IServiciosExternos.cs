namespace Backend_Almacen.Application.Abstracciones
{
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
