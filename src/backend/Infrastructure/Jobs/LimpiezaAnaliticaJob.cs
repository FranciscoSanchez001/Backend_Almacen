using Core.Application.Abstracciones;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Jobs
{
    public class AnaliticaOptions
    {
        // Los eventos de comportamiento solo sirven para tendencias recientes: no se guardan para siempre.
        public int DiasRetencion { get; set; } = 180;

        public TimeSpan Intervalo { get; set; } = TimeSpan.FromDays(1);
    }

    // Borra los eventos de analítica más viejos que DiasRetencion.
    public class LimpiezaAnaliticaJob(
        IServiceScopeFactory scopes,
        AnaliticaOptions options,
        ILogger<LimpiezaAnaliticaJob> logger) : BackgroundService
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
                var analitica = scope.ServiceProvider.GetRequiredService<IAnaliticaRepository>();
                var borrados = await analitica.EliminarAnterioresAsync(DateTime.UtcNow.AddDays(-options.DiasRetencion), ct);
                if (borrados > 0)
                {
                    logger.LogInformation("Limpieza de analítica: {Borrados} eventos de más de {Dias} días.",
                        borrados, options.DiasRetencion);
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogError(ex, "Falló la limpieza de eventos de analítica.");
            }
        }
    }
}
