using Core.Application.Dtos;
using Core.Domain.Enums;
using FluentValidation;

namespace Core.Application.Validadores
{
    // Reglas comunes a la creación y la edición de cupones.
    public class DatosCuponValidator : AbstractValidator<IDatosCupon>
    {
        public DatosCuponValidator()
        {
            RuleFor(x => x.Descripcion)
                .MaximumLength(200).WithMessage("La descripción admite como máximo 200 caracteres.");

            RuleFor(x => x.Tipo)
                .IsInEnum().WithMessage("El tipo debe ser porcentaje o monto_fijo.");

            RuleFor(x => x.Valor)
                .GreaterThan(0).WithMessage("El valor del cupón debe ser mayor que 0.");
            RuleFor(x => x.Valor)
                .LessThanOrEqualTo(100).WithMessage("Un cupón de porcentaje no puede pasar del 100 %.")
                .When(x => x.Tipo == TipoCupon.Porcentaje);
            RuleFor(x => x.Valor)
                .LessThanOrEqualTo(DatosProductoValidator.MontoMaximo)
                .WithMessage($"El monto no puede superar {DatosProductoValidator.MontoMaximo:N0} USD.")
                .When(x => x.Tipo == TipoCupon.MontoFijo);

            RuleFor(x => x.CompraMinimaUsd)
                .GreaterThanOrEqualTo(0).WithMessage("La compra mínima no puede ser negativa.")
                .LessThanOrEqualTo(DatosProductoValidator.MontoMaximo)
                .WithMessage($"La compra mínima no puede superar {DatosProductoValidator.MontoMaximo:N0} USD.");

            RuleFor(x => x.ValidoHasta)
                .GreaterThan(x => x.ValidoDesde).WithMessage("El cupón debe vencer después de empezar.")
                .When(x => x.ValidoDesde is not null && x.ValidoHasta is not null);

            RuleFor(x => x.UsosMaximos)
                .GreaterThan(0).WithMessage("El límite de usos debe ser mayor que 0.")
                .LessThanOrEqualTo(1_000_000).WithMessage("El límite de usos no puede superar 1.000.000.");
        }
    }

    public class CrearCuponValidator : AbstractValidator<CrearCuponRequest>
    {
        public CrearCuponValidator()
        {
            Include(new DatosCuponValidator());

            RuleFor(x => x.Codigo)
                .NotEmpty().WithMessage("El código es obligatorio.")
                .Length(3, 30).WithMessage("El código debe tener entre 3 y 30 caracteres.")
                .Matches("^[A-Za-z0-9_-]+$").WithMessage("El código solo admite letras, números, guiones y guiones bajos.");
        }
    }

    public class ActualizarCuponValidator : AbstractValidator<ActualizarCuponRequest>
    {
        public ActualizarCuponValidator()
        {
            Include(new DatosCuponValidator());
        }
    }

    public class CotizarPedidoValidator : AbstractValidator<CotizarPedidoRequest>
    {
        public CotizarPedidoValidator()
        {
            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("El pedido debe tener al menos un producto.")
                .Must(i => i.Count <= 50).WithMessage("El pedido admite como máximo 50 productos.");
            RuleForEach(x => x.Items).SetValidator(new ItemPedidoValidator());
            RuleFor(x => x.CodigoCupon)
                .MaximumLength(30).WithMessage("El código del cupón admite como máximo 30 caracteres.");
        }
    }
}
