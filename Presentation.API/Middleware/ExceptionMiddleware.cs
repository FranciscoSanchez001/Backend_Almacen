using System.Diagnostics;
using Core.Application.Excepciones;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace Presentation.API.Middleware
{
    // Manejo global de errores con Problem Details (RFC 7807, hoy RFC 9457). Captura cualquier
    // excepción no controlada y responde application/problem+json:
    //   ValidationException (FluentValidation) -> 400 Bad Request, con el detalle por campo en errors
    //   InvalidOperationException              -> 400 Bad Request
    //   KeyNotFoundException                   -> 404 Not Found
    //   ConflictoException                     -> 409 Conflict
    //   cualquier otra                         -> 500 Internal Server Error, sin mensaje ni stack trace
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

        // También lo usan los eventos de JwtBearer (Program.cs) para que 401 y 403 salgan con el
        // mismo formato que el resto de los errores.
        public static async Task EscribirAsync(HttpContext context, int status, string titulo, string tipo,
            string? detalle, IDictionary<string, string[]>? errores = null)
        {
            var problema = errores is null
                ? new ProblemDetails()
                : new ValidationProblemDetails(errores);
            problema.Type = tipo;
            problema.Title = titulo;
            problema.Status = status;
            problema.Detail = detalle;
            problema.Instance = context.Request.Path;
            problema.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;

            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(problema, problema.GetType(),
                (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json", context.RequestAborted);
        }

        private async Task EscribirProblemaAsync(HttpContext context, Exception ex)
        {
            var (status, titulo, tipo, detalle) = ex switch
            {
                ValidationException => (StatusCodes.Status400BadRequest, "Uno o más datos no son válidos.",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.1", "Revisa los campos indicados en errors."),
                InvalidOperationException => (StatusCodes.Status400BadRequest, "Solicitud inválida",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.1", ex.Message),
                KeyNotFoundException => (StatusCodes.Status404NotFound, "Recurso no encontrado",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.5", ex.Message),
                ConflictoException => (StatusCodes.Status409Conflict, "Conflicto con el estado actual",
                    "https://tools.ietf.org/html/rfc9110#section-15.5.10", ex.Message),
                _ => (StatusCodes.Status500InternalServerError, "Error interno del servidor",
                    "https://tools.ietf.org/html/rfc9110#section-15.6.1", MensajeErrorInterno),
            };

            if (status >= StatusCodes.Status500InternalServerError)
            {
                logger.LogError(ex, "Error no controlado en {Metodo} {Ruta} (traceId {TraceId}).",
                    context.Request.Method, context.Request.Path, Activity.Current?.Id ?? context.TraceIdentifier);
            }
            else
            {
                logger.LogWarning("{Tipo} en {Metodo} {Ruta}: {Mensaje}",
                    ex.GetType().Name, context.Request.Method, context.Request.Path, ex.Message);
            }

            var errores = (ex as ValidationException)?.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            // Descarta lo que la acción haya alcanzado a preparar (cabeceras incluidas).
            context.Response.Clear();
            await EscribirAsync(context, status, titulo, tipo, detalle, errores);
        }
    }
}
