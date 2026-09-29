using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Presentation.API.Filtros
{
    // Validación defensiva: antes de ejecutar cualquier acción, pasa cada argumento por su
    // IValidator<T> de FluentValidation (si tiene uno registrado). Si alguna regla falla, la acción
    // no se ejecuta y se responde 400 Bad Request con application/problem+json y el detalle de
    // cada error por campo:
    //   { "title": "...", "status": 400, "errors": { "precioUsd": ["El precio debe ser mayor que 0."] } }
    public class ValidacionFilter : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var servicios = context.HttpContext.RequestServices;
            var errores = new ModelStateDictionary();

            foreach (var argumento in context.ActionArguments.Values)
            {
                if (argumento is null)
                {
                    continue;
                }
                var tipo = typeof(IValidator<>).MakeGenericType(argumento.GetType());
                if (servicios.GetService(tipo) is not IValidator validador)
                {
                    continue;
                }

                var resultado = await validador.ValidateAsync(new ValidationContext<object>(argumento),
                    context.HttpContext.RequestAborted);
                foreach (var error in resultado.Errors)
                {
                    errores.AddModelError(NombreJson(error.PropertyName), error.ErrorMessage);
                }
            }

            if (errores.ErrorCount > 0)
            {
                var problema = servicios.GetRequiredService<ProblemDetailsFactory>().CreateValidationProblemDetails(
                    context.HttpContext, errores, StatusCodes.Status400BadRequest,
                    title: "Uno o más datos no son válidos.",
                    detail: "Revisa los campos indicados en errors.",
                    instance: context.HttpContext.Request.Path);
                context.Result = new BadRequestObjectResult(problema)
                {
                    ContentTypes = { "application/problem+json" },
                };
                return;
            }

            await next();
        }

        // "Items[0].Cantidad" -> "items[0].cantidad", igual que las propiedades del JSON.
        private static string NombreJson(string propiedad) =>
            string.Join('.', propiedad.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));
    }
}
