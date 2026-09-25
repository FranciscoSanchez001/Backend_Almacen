using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Middleware
{
    // Manejo global de errores con Problem Details (RFC 7807, hoy RFC 9457). Captura cualquier
    // excepción no controlada y responde application/problem+json:
    //   KeyNotFoundException      -> 404 Not Found
    //   InvalidOperationException -> 400 Bad Request
    //   cualquier otra            -> 500 Internal Server Error, sin mensaje ni stack trace
    // El detalle completo queda solo en el log del servidor, enlazado por el traceId.
    // Implementa IMiddleware, así que el contenedor lo crea por petición (registrado como Transient).
    public class ExceptionMiddleware(ILogger<ExceptionMiddleware> logger) : IMiddleware
    {
        public const string MensajeErrorInterno = "Ocurrió un error inesperado. Intenta de nuevo más tarde.";

        public async Task InvokeAsync(HttpContext context, RequestDelegate next)
        {
            try
            {
                await next(context);
            }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
            {
                // El cliente cerró la conexión: no hay a quién responder.
            }
            catch (Exception ex)
            {
                if (context.Response.HasStarted)
                {
                    // Ya se enviaron cabeceras; no se puede cambiar la respuesta.
                    throw;
                }

                await EscribirProblemaAsync(context, ex);
            }
        }

        private async Task EscribirProblemaAsync(HttpContext context, Exception ex)
        {
            var (status, titulo, tipo, detalle) = ex switch
            {
                KeyNotFoundException => (StatusCodes.Status404NotFound, "Recurso no encontrado",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.5", ex.Message),
                InvalidOperationException => (StatusCodes.Status400BadRequest, "Solicitud inválida",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.1", ex.Message),
                _ => (StatusCodes.Status500InternalServerError, "Error interno del servidor",
                    "https://tools.ietf.org/html/rfc9110#section-15.6.1", MensajeErrorInterno),
            };

            var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
            if (status >= StatusCodes.Status500InternalServerError)
            {
                logger.LogError(ex, "Error no controlado en {Metodo} {Ruta} (traceId {TraceId}).",
                    context.Request.Method, context.Request.Path, traceId);
            }
            else
            {
                logger.LogWarning("{Tipo} en {Metodo} {Ruta}: {Mensaje}",
                    ex.GetType().Name, context.Request.Method, context.Request.Path, ex.Message);
            }

            var problema = new ProblemDetails
            {
                Type = tipo,
                Title = titulo,
                Status = status,
                Detail = detalle,
                Instance = context.Request.Path,
            };
            problema.Extensions["traceId"] = traceId;

            context.Response.Clear();
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(problema, (System.Text.Json.JsonSerializerOptions?)null,
                "application/problem+json", context.RequestAborted);
        }
    }
}
