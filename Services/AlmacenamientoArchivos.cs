using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace Backend_Almacen.Services
{
    // Dónde se guardan las capturas de pago. Si la sección "Cloudinary" está configurada se usa
    // Cloudinary; si no, disco local (solo para desarrollo).
    public interface IAlmacenamientoArchivos
    {
        // Devuelve la URL con la que se podrá ver el archivo.
        Task<string> GuardarAsync(IFormFile archivo, string carpeta, CancellationToken ct = default);

        // Best effort: se usa para limpiar si el pedido no llegó a crearse.
        Task EliminarAsync(string url);
    }

    public class CloudinaryOptions
    {
        public string? CloudName { get; set; }
        public string? ApiKey { get; set; }
        public string? ApiSecret { get; set; }

        public bool Configurado =>
            !string.IsNullOrWhiteSpace(CloudName) && !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(ApiSecret);
    }

    public class AlmacenamientoCloudinary(CloudinaryOptions options, ILogger<AlmacenamientoCloudinary> logger)
        : IAlmacenamientoArchivos
    {
        private readonly Cloudinary cloudinary = new(new Account(options.CloudName, options.ApiKey, options.ApiSecret));

        public async Task<string> GuardarAsync(IFormFile archivo, string carpeta, CancellationToken ct = default)
        {
            await using var stream = archivo.OpenReadStream();
            var resultado = await cloudinary.UploadAsync(new ImageUploadParams
            {
                File = new FileDescription(archivo.FileName, stream),
                Folder = carpeta,
                UseFilename = false,
                UniqueFilename = true,
            }, ct);

            if (resultado.Error is not null)
            {
                throw new InvalidOperationException($"Cloudinary: {resultado.Error.Message}");
            }
            return resultado.SecureUrl.ToString();
        }

        public async Task EliminarAsync(string url)
        {
            try
            {
                // https://res.cloudinary.com/<cloud>/image/upload/v123/<carpeta>/<id>.<ext>
                var ruta = new Uri(url).AbsolutePath;
                var desde = ruta.IndexOf("/upload/", StringComparison.Ordinal);
                if (desde < 0)
                {
                    return;
                }
                var partes = ruta[(desde + "/upload/".Length)..].Split('/').ToList();
                if (partes.Count > 1 && partes[0].StartsWith('v') && partes[0][1..].All(char.IsDigit))
                {
                    partes.RemoveAt(0);
                }
                var publicId = Path.ChangeExtension(string.Join('/', partes), null);
                await cloudinary.DestroyAsync(new DeletionParams(publicId));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "No se pudo borrar {Url} de Cloudinary.", url);
            }
        }
    }

    // Guarda en wwwroot/<carpeta> y devuelve una ruta relativa (/capturas/xxx.jpg) servida por la API.
    public class AlmacenamientoLocal(IWebHostEnvironment env, ILogger<AlmacenamientoLocal> logger) : IAlmacenamientoArchivos
    {
        public async Task<string> GuardarAsync(IFormFile archivo, string carpeta, CancellationToken ct = default)
        {
            var directorio = Path.Combine(env.ContentRootPath, "wwwroot", carpeta);
            Directory.CreateDirectory(directorio);

            var nombre = $"{Guid.NewGuid():N}{Path.GetExtension(archivo.FileName).ToLowerInvariant()}";
            await using (var destino = File.Create(Path.Combine(directorio, nombre)))
            {
                await archivo.CopyToAsync(destino, ct);
            }
            return $"/{carpeta}/{nombre}";
        }

        public Task EliminarAsync(string url)
        {
            try
            {
                var ruta = Path.Combine(env.ContentRootPath, "wwwroot", url.TrimStart('/'));
                if (File.Exists(ruta))
                {
                    File.Delete(ruta);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "No se pudo borrar {Url}.", url);
            }
            return Task.CompletedTask;
        }
    }
}
