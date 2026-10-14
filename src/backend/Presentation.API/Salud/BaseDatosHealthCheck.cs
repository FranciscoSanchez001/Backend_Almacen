using Core.Application.Abstracciones;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Presentation.API.Salud
{
    // Verificación de salud de GET /health: la API está sana solo si puede abrir una conexión con
    // PostgreSQL. La usa el healthcheck de docker-compose para que la SPA espere a la API.
    public class BaseDatosHealthCheck(IDiagnosticoBaseDatos diagnostico) : IHealthCheck
    {
        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
            CancellationToken cancellationToken = default) =>
            await diagnostico.PuedeConectarAsync(cancellationToken)
                ? HealthCheckResult.Healthy("Conexión con PostgreSQL disponible.")
                : HealthCheckResult.Unhealthy("No se puede conectar con PostgreSQL.");
    }
}
