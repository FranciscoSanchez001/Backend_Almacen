using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Backend_Almacen.Data;
using Backend_Almacen.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend_Almacen.Services
{
    public enum PlantillaWhatsapp
    {
        Aprobado,
        Rechazado,
        Expirado,
        EnCamino,
        Entregado
    }

    public class WhatsappOptions
    {
        // URL del servicio de Baileys (p. ej. http://localhost:3001). Sin ella, los mensajes
        // quedan registrados con estado error.
        public string? ServicioUrl { get; set; }
        public string? ApiKey { get; set; }
    }

    public record MensajeEnCola(int PedidoId, string Telefono, PlantillaWhatsapp Plantilla, string Texto);

    // Los mensajes se encolan después del commit y los envía EnvioWhatsappWorker en segundo plano,
    // para que aprobar o rechazar no espere al servicio de WhatsApp ni falle si está caído.
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
                $"¡Hola {p.Cliente.Nombre}! Tu compra #{p.Id} por ${Monto(p.TotalUsd)} (Bs {Monto(p.TotalBs)}) " +
                $"fue aprobada y será enviada a: {p.DireccionTexto}, {p.Zona.Nombre}.",
            PlantillaWhatsapp.Rechazado =>
                $"Hola {p.Cliente.Nombre}, tu compra #{p.Id} fue rechazada porque {p.MotivoRechazo}. " +
                $"Si crees que es un error, escríbenos al {soporte}.",
            PlantillaWhatsapp.Expirado =>
                $"Hola {p.Cliente.Nombre}, tu pedido #{p.Id} no pudo ser procesado a tiempo y fue cancelado. " +
                $"Si ya realizaste el pago, comunícate al {soporte}.",
            PlantillaWhatsapp.EnCamino =>
                $"Tu pedido #{p.Id} ya va en camino.",
            PlantillaWhatsapp.Entregado =>
                $"Tu pedido #{p.Id} fue entregado. Si no llegó o no llegó en buen estado, comunícate al {soporte}.",
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
            var db = scope.ServiceProvider.GetRequiredService<AlmacenDbContext>();

            var numerosPrueba = await db.Configuracion.AsNoTracking()
                .Where(c => c.Id == 1).Select(c => c.NumerosPrueba).SingleAsync(ct);
            var permitidos = numerosPrueba.Select(Telefonos.NormalizarVenezolano).ToHashSet();

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

            db.MensajesWhatsapp.Add(registro);
            await db.SaveChangesAsync(ct);
        }
    }
}
