using System.Text;
using System.Text.Json;
using Core.Application.Abstracciones;
using Core.Application.Servicios;
using Core.Domain.Entidades;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Mensajeria
{
    public class WhatsappOptions
    {
        // URL del servicio de Baileys (p. ej. http://localhost:3001). Sin ella, los mensajes
        // quedan registrados con estado error.
        public string? ServicioUrl { get; set; }
        public string? ApiKey { get; set; }
    }

    // Consume la ColaWhatsapp: aplica la lista blanca, llama al servicio de Baileys
    // (POST {ServicioUrl}/enviar con {telefono, texto}) y registra cada envío en mensajes_whatsapp.
    public class EnvioWhatsappWorker(
        ColaWhatsapp cola,
        IServiceScopeFactory scopes,
        IHttpClientFactory http,
        WhatsappOptions options,
        ILogger<EnvioWhatsappWorker> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var mensaje in cola.Lector.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcesarAsync(mensaje, stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogError(ex, "No se pudo registrar el mensaje de WhatsApp del pedido {PedidoId}.", mensaje.PedidoId);
                }
            }
        }

        private async Task ProcesarAsync(MensajeEnCola mensaje, CancellationToken ct)
        {
            using var scope = scopes.CreateScope();
            var configuracion = scope.ServiceProvider.GetRequiredService<IConfiguracionRepository>();
            var mensajes = scope.ServiceProvider.GetRequiredService<IMensajeWhatsappRepository>();
            var unidad = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var permitidos = (await configuracion.ObtenerAsync(ct)).NumerosPrueba
                .Select(Telefonos.NormalizarVenezolano)
                .ToHashSet();

            var registro = new MensajeWhatsapp
            {
                PedidoId = mensaje.PedidoId,
                Telefono = mensaje.Telefono,
                Plantilla = ColaWhatsapp.Nombre(mensaje.Plantilla),
                Texto = mensaje.Texto,
            };

            if (!permitidos.Contains(mensaje.Telefono))
            {
                // Lista blanca: solo se envía a los números del equipo; el resto solo se registra.
                registro.Estado = EstadoMensajeWhatsapp.BloqueadoListaBlanca;
            }
            else if (string.IsNullOrWhiteSpace(options.ServicioUrl))
            {
                registro.Estado = EstadoMensajeWhatsapp.Error;
                registro.Error = "El servicio de WhatsApp no está configurado (Whatsapp:ServicioUrl).";
            }
            else
            {
                try
                {
                    var cliente = http.CreateClient(nameof(EnvioWhatsappWorker));
                    using var request = new HttpRequestMessage(HttpMethod.Post, $"{options.ServicioUrl.TrimEnd('/')}/enviar")
                    {
                        // Baileys usa el número sin "+". StringContent (y no JsonContent) para que
                        // vaya con Content-Length: algunos servidores no leen cuerpos chunked.
                        Content = new StringContent(
                            JsonSerializer.Serialize(new { telefono = mensaje.Telefono.TrimStart('+'), texto = mensaje.Texto }),
                            Encoding.UTF8, "application/json"),
                    };
                    if (!string.IsNullOrWhiteSpace(options.ApiKey))
                    {
                        request.Headers.Add("X-Api-Key", options.ApiKey);
                    }

                    using var respuesta = await cliente.SendAsync(request, ct);
                    if (respuesta.IsSuccessStatusCode)
                    {
                        registro.Estado = EstadoMensajeWhatsapp.Enviado;
                    }
                    else
                    {
                        registro.Estado = EstadoMensajeWhatsapp.Error;
                        registro.Error = $"HTTP {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync(ct)}";
                    }
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
                {
                    registro.Estado = EstadoMensajeWhatsapp.Error;
                    registro.Error = ex.Message;
                }
            }

            mensajes.Agregar(registro);
            await unidad.GuardarCambiosAsync(ct);
        }
    }
}
