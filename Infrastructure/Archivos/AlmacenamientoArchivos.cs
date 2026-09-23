using Backend_Almacen.Application.Abstracciones;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Backend_Almacen.Infrastructure.Archivos
{
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

        public async Task<string> GuardarAsync(Stream contenido, string nombreArchivo, string carpeta,
            CancellationToken ct = default)
        {
            var resultado = await cloudinary.UploadAsync(new ImageUploadParams
            {
                File = new FileDescription(nombreArchivo, contenido),
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

    // Solo para desarrollo: guarda en <raíz del contenido>/wwwroot/<carpeta> y devuelve una ruta
    // relativa (/capturas/xxx.jpg) que sirve la WebAPI.
    public class AlmacenamientoLocal(IHostEnvironment env, ILogger<AlmacenamientoLocal> logger) : IAlmacenamientoArchivos
    {
        public string RaizPublica { get; } = Path.Combine(env.ContentRootPath, "wwwroot");

        public async Task<string> GuardarAsync(Stream contenido, string nombreArchivo, string carpeta,
            CancellationToken ct = default)
        {
            var directorio = Path.Combine(RaizPublica, carpeta);
            Directory.CreateDirectory(directorio);

            var nombre = $"{Guid.NewGuid():N}{Path.GetExtension(nombreArchivo).ToLowerInvariant()}";
            await using (var destino = File.Create(Path.Combine(directorio, nombre)))
            {
                await contenido.CopyToAsync(destino, ct);
            }
            return $"/{carpeta}/{nombre}";
        }

        public Task EliminarAsync(string url)
        {
            try
            {
                var ruta = Path.Combine(RaizPublica, url.TrimStart('/'));
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
