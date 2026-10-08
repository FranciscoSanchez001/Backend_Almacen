using Core.Application.Servicios;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Jobs
{
    public class ExpiracionOptions
    {
        // El PDF pide que corra cada 5 a 10 minutos.
        public TimeSpan Intervalo { get; set; } = TimeSpan.FromMinutes(5);

        // Con cuánta anticipación se avisa a ventas de que un pedido está por vencer.
        public TimeSpan AvisoPorExpirar { get; set; } = TimeSpan.FromHours(1);
    }

    // Pasa a "expirado" los pedidos pendientes con expira_en vencido: libera su stock, deja la
    // línea en el historial (usuario null = sistema) y envía el WhatsApp de expiración.
    public class ExpiracionPedidosJob(
        IServiceScopeFactory scopes,
        ExpiracionOptions options,
        ILogger<ExpiracionPedidosJob> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(options.Intervalo);
            do
            {
                await EjecutarAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }

        private async Task EjecutarAsync(CancellationToken ct)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var pedidos = scope.ServiceProvider.GetRequiredService<PedidosService>();

                var expirados = await pedidos.ExpirarVencidosAsync(ct);
                var avisos = await pedidos.AvisarPorExpirarAsync(options.AvisoPorExpirar, ct);
                if (expirados > 0 || avisos > 0)
                {
                    logger.LogInformation("Job de expiración: {Expirados} pedidos expirados, {Avisos} avisos de por expirar.",
                        expirados, avisos);
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                // Si la base está caída se reintenta en el siguiente ciclo.
                logger.LogError(ex, "Falló el job de expiración de pedidos.");
            }
        }
    }
}
