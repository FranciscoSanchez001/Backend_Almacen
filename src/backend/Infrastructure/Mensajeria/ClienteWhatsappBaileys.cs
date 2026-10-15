using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Mensajeria
{
    // Habla con el servicio de Baileys (src/whatsapp) para la pantalla Administración > WhatsApp.
    // El servicio no se publica fuera de Docker: el navegador nunca lo llama directo, siempre pasa
    // por la API, que agrega la clave (X-Api-Key) y exige el rol superadmin.
    public class ClienteWhatsappBaileys(IHttpClientFactory http, WhatsappOptions options, ILogger<ClienteWhatsappBaileys> logger)
        : IClienteWhatsapp
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private sealed record RespuestaEstado(string? Estado, string? Qr, string? Numero, string? Nombre, string? Mensaje);
        private sealed record RespuestaError(string? Error);

        private bool Configurado => !string.IsNullOrWhiteSpace(options.ServicioUrl);

        private static EstadoWhatsapp SinConfigurar() => new(false, false, "desconectado", null, null, null,
            "El servicio de WhatsApp no está configurado (Whatsapp:ServicioUrl).");

        private static EstadoWhatsapp Caido(string detalle) => new(true, false, "desconectado", null, null, null,
            $"No se pudo contactar al servicio de WhatsApp: {detalle}");

        public Task<EstadoWhatsapp> EstadoAsync(CancellationToken ct = default) => PedirEstadoAsync(HttpMethod.Get, "estado", ct);
        public Task<EstadoWhatsapp> VincularAsync(CancellationToken ct = default) => PedirEstadoAsync(HttpMethod.Post, "vincular", ct);
        public Task<EstadoWhatsapp> DesvincularAsync(CancellationToken ct = default) => PedirEstadoAsync(HttpMethod.Post, "desvincular", ct);

        public async Task<string?> EnviarAsync(string telefono, string texto, CancellationToken ct = default)
        {
            if (!Configurado)
            {
                return SinConfigurar().Mensaje;
            }
            try
            {
                using var request = Peticion(HttpMethod.Post, "enviar");
                request.Content = new StringContent(JsonSerializer.Serialize(new { telefono, texto }), Encoding.UTF8, "application/json");
                using var respuesta = await Cliente().SendAsync(request, ct);
                if (respuesta.IsSuccessStatusCode)
                {
                    return null;
                }
                var error = await LeerAsync<RespuestaError>(respuesta, ct);
                return error?.Error ?? $"El servicio respondió HTTP {(int)respuesta.StatusCode}.";
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                return Caido(ex.Message).Mensaje;
            }
        }

        private async Task<EstadoWhatsapp> PedirEstadoAsync(HttpMethod metodo, string ruta, CancellationToken ct)
        {
            if (!Configurado)
            {
                return SinConfigurar();
            }
            try
            {
                using var request = Peticion(metodo, ruta);
                using var respuesta = await Cliente().SendAsync(request, ct);
                if (!respuesta.IsSuccessStatusCode)
                {
                    var error = await LeerAsync<RespuestaError>(respuesta, ct);
                    return Caido(error?.Error ?? $"HTTP {(int)respuesta.StatusCode}");
                }
                var e = await LeerAsync<RespuestaEstado>(respuesta, ct);
                return new EstadoWhatsapp(true, true, e?.Estado ?? "desconectado", e?.Qr, e?.Numero, e?.Nombre, e?.Mensaje);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "El servicio de WhatsApp no respondió ({Ruta}).", ruta);
                return Caido(ex.Message);
            }
        }

        private HttpClient Cliente() => http.CreateClient(nameof(ClienteWhatsappBaileys));

        private HttpRequestMessage Peticion(HttpMethod metodo, string ruta)
        {
            var request = new HttpRequestMessage(metodo, $"{options.ServicioUrl!.TrimEnd('/')}/{ruta}");
            if (!string.IsNullOrWhiteSpace(options.ApiKey))
            {
                request.Headers.Add("X-Api-Key", options.ApiKey);
            }
            return request;
        }

        private static async Task<T?> LeerAsync<T>(HttpResponseMessage respuesta, CancellationToken ct)
        {
            try
            {
                return await respuesta.Content.ReadFromJsonAsync<T>(Json, ct);
            }
            catch (JsonException)
            {
                return default;
            }
        }
    }
}
