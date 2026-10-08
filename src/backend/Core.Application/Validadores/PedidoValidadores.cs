using Core.Application.Dtos;
using Core.Domain.Reglas;
using FluentValidation;

namespace Core.Application.Validadores
{
    public class ItemPedidoValidator : AbstractValidator<ItemPedidoRequest>
    {
        public ItemPedidoValidator()
        {
            RuleFor(x => x.ProductoId).NotEmpty().WithMessage("El producto es obligatorio.");
            RuleFor(x => x.Cantidad)
                .InclusiveBetween(1, 1000).WithMessage("La cantidad debe estar entre 1 y 1000.");
        }
    }

    // Datos del checkout. La captura del pago (archivo) la valida la API en CrearPedidoFormValidator.
    public class DatosPedidoValidator : AbstractValidator<DatosPedido>
    {
        public DatosPedidoValidator()
        {
            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("El pedido debe tener al menos un producto.")
                .Must(i => i.Count <= 50).WithMessage("El pedido admite como máximo 50 productos.");
            RuleForEach(x => x.Items).SetValidator(new ItemPedidoValidator());

            RuleFor(x => x.MetodoPago)
                .Must(m => DatosPedido.ParsearMetodoPago(m) is not null)
                .WithMessage("Debe ser transferencia, pago_movil o binance.");
            RuleFor(x => x.ReferenciaPago)
                .NotEmpty().WithMessage("La referencia del pago es obligatoria.")
                .MaximumLength(100).WithMessage("La referencia del pago admite como máximo 100 caracteres.");
            RuleFor(x => x.ZonaId).NotEmpty().WithMessage("La zona de entrega es obligatoria.");
            RuleFor(x => x.DireccionTexto)
                .NotEmpty().WithMessage("La dirección es obligatoria.")
                .Length(5, 500).WithMessage("La dirección debe tener entre 5 y 500 caracteres.");
            RuleFor(x => x.Latitud)
                .InclusiveBetween(-90, 90).WithMessage("La latitud debe estar entre -90 y 90.");
            RuleFor(x => x.Longitud)
                .InclusiveBetween(-180, 180).WithMessage("La longitud debe estar entre -180 y 180.");
            RuleFor(x => x.Telefono)
                .Must(t => Telefonos.NormalizarVenezolano(t) is not null)
                .WithMessage("Debe ser un celular venezolano: +58 4XX XXX XXXX.");
        }
    }

    public class AprobarPedidoValidator : AbstractValidator<AprobarPedidoRequest>
    {
        public AprobarPedidoValidator()
        {
            RuleFor(x => x.RepartidorId).NotEmpty().WithMessage("Debes elegir un repartidor.");
        }
    }

    public class RechazarPedidoValidator : AbstractValidator<RechazarPedidoRequest>
    {
        public RechazarPedidoValidator()
        {
            RuleFor(x => x.Motivo)
                .MaximumLength(300).WithMessage("El motivo admite como máximo 300 caracteres.");
        }
    }
}
