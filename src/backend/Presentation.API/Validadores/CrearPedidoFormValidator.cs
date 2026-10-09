using Core.Application.Validadores;
using FluentValidation;
using Presentation.API.Dtos;

namespace Presentation.API.Validadores
{
    // Reutiliza las reglas de negocio de DatosPedidoValidator (Core.Application) y agrega solo la
    // validación del archivo de la captura, que depende de ASP.NET (IFormFile).
    public class CrearPedidoFormValidator : AbstractValidator<CrearPedidoForm>
    {
        public const long TamanoMaximoCaptura = 5 * 1024 * 1024;
        private static readonly string[] TiposCaptura = ["image/jpeg", "image/png", "image/webp"];

        public CrearPedidoFormValidator()
        {
            Include(new DatosPedidoValidator());

            RuleFor(x => x.Captura)
                .NotNull().WithMessage("La captura del pago es obligatoria.");
            RuleFor(x => x.Captura!.Length)
                .InclusiveBetween(1, TamanoMaximoCaptura).WithMessage("La captura debe pesar como máximo 5 MB.")
                .OverridePropertyName(nameof(CrearPedidoForm.Captura))
                .When(x => x.Captura is not null);
            RuleFor(x => x.Captura!.ContentType)
                .Must(t => TiposCaptura.Contains(t.ToLowerInvariant()))
                .WithMessage("La captura debe ser una imagen JPG, PNG o WEBP.")
                .OverridePropertyName(nameof(CrearPedidoForm.Captura))
                .When(x => x.Captura is not null);
        }
    }
}
