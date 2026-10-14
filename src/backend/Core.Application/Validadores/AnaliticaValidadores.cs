using Core.Application.Dtos;
using Core.Domain.Enums;
using FluentValidation;

namespace Core.Application.Validadores
{
    public class EventoRequestValidator : AbstractValidator<EventoRequest>
    {
        public EventoRequestValidator()
        {
            RuleFor(x => x.Tipo)
                .IsInEnum().WithMessage("El tipo de evento no es válido.")
                // Las búsquedas las registra el servidor al responder /catalogo, con los resultados reales.
                .NotEqual(TipoEventoAnalitica.Busqueda).WithMessage("Las búsquedas no se registran por aquí.");
            RuleFor(x => x.Ruta).MaximumLength(200).WithMessage("La ruta admite como máximo 200 caracteres.");
            RuleFor(x => x.Texto).MaximumLength(200).WithMessage("El texto admite como máximo 200 caracteres.");
            RuleFor(x => x.Cantidad)
                .InclusiveBetween(1, 1000).WithMessage("La cantidad debe estar entre 1 y 1000.")
                .When(x => x.Cantidad is not null);
            RuleFor(x => x.Valor)
                .InclusiveBetween(0, DatosProductoValidator.MontoMaximo).WithMessage("El valor no es razonable.")
                .When(x => x.Valor is not null);
        }
    }

    public class RegistrarEventosValidator : AbstractValidator<RegistrarEventosRequest>
    {
        public const int MaximoPorLote = 50;

        public RegistrarEventosValidator()
        {
            RuleFor(x => x.SesionId)
                .NotEmpty().WithMessage("La sesión es obligatoria.")
                .Length(8, 64).WithMessage("La sesión debe tener entre 8 y 64 caracteres.")
                .Matches("^[A-Za-z0-9-]+$").WithMessage("La sesión solo admite letras, números y guiones.");
            RuleFor(x => x.Eventos)
                .NotEmpty().WithMessage("El lote debe traer al menos un evento.")
                .Must(e => e.Count <= MaximoPorLote).WithMessage($"El lote admite como máximo {MaximoPorLote} eventos.");
            RuleForEach(x => x.Eventos).SetValidator(new EventoRequestValidator());
        }
    }
}
