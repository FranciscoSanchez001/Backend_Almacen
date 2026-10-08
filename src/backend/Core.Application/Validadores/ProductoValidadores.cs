using Core.Application.Dtos;
using FluentValidation;

namespace Core.Application.Validadores
{
    // Reglas comunes a la creación y la edición de productos.
    public class DatosProductoValidator : AbstractValidator<IDatosProducto>
    {
        public const decimal MontoMaximo = 1_000_000m;
        public const int StockTope = 1_000_000;

        public DatosProductoValidator()
        {
            RuleFor(x => x.CodigoSku)
                .NotEmpty().WithMessage("El código SKU es obligatorio.")
                .MaximumLength(30).WithMessage("El código SKU admite como máximo 30 caracteres.")
                .Matches("^[A-Za-z0-9-]+$").WithMessage("El código SKU solo admite letras, números y guiones.");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio.")
                .MaximumLength(200).WithMessage("El nombre admite como máximo 200 caracteres.");

            RuleFor(x => x.Descripcion)
                .MaximumLength(1000).WithMessage("La descripción admite como máximo 1000 caracteres.");

            RuleFor(x => x.PrecioUsd)
                .GreaterThan(0).WithMessage("El precio debe ser mayor que 0.")
                .LessThanOrEqualTo(MontoMaximo).WithMessage($"El precio no puede superar {MontoMaximo:N0} USD.");

            RuleFor(x => x.CostoUsd)
                .GreaterThan(0).WithMessage("El costo debe ser mayor que 0.")
                .LessThanOrEqualTo(MontoMaximo).WithMessage($"El costo no puede superar {MontoMaximo:N0} USD.");

            RuleFor(x => x.ImagenUrl)
                .MaximumLength(500).WithMessage("La URL de la imagen admite como máximo 500 caracteres.")
                .Must(EsUrlHttp).WithMessage("La URL de la imagen debe ser http o https.")
                .When(x => !string.IsNullOrWhiteSpace(x.ImagenUrl));

            RuleFor(x => x.CategoriaId)
                .NotEmpty().WithMessage("La categoría es obligatoria.");

            RuleFor(x => x.StockMinimo)
                .GreaterThanOrEqualTo(0).WithMessage("El stock mínimo no puede ser negativo.")
                .LessThan(StockTope).WithMessage($"El stock mínimo debe ser menor que {StockTope:N0}.");

            RuleFor(x => x.StockMaximo)
                .GreaterThan(x => x.StockMinimo).WithMessage("El stock máximo debe ser mayor que el stock mínimo.")
                .LessThanOrEqualTo(StockTope).WithMessage($"El stock máximo no puede superar {StockTope:N0}.");

            RuleFor(x => x.Ubicacion)
                .MaximumLength(50).WithMessage("La ubicación admite como máximo 50 caracteres.");

            RuleFor(x => x.UnidadMedida)
                .NotEmpty().WithMessage("La unidad de medida es obligatoria.")
                .MaximumLength(20).WithMessage("La unidad de medida admite como máximo 20 caracteres.");
        }

        private static bool EsUrlHttp(string? url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    public class CrearProductoValidator : AbstractValidator<CrearProductoRequest>
    {
        public CrearProductoValidator()
        {
            Include(new DatosProductoValidator());

            RuleFor(x => x.StockInicial)
                .GreaterThanOrEqualTo(0).WithMessage("El stock inicial no puede ser negativo.")
                .LessThanOrEqualTo(DatosProductoValidator.StockTope)
                .WithMessage($"El stock inicial no puede superar {DatosProductoValidator.StockTope:N0}.");
        }
    }

    public class ActualizarProductoValidator : AbstractValidator<ActualizarProductoRequest>
    {
        public ActualizarProductoValidator()
        {
            Include(new DatosProductoValidator());

            RuleFor(x => x.StockDisponible)
                .GreaterThanOrEqualTo(0).WithMessage("El stock disponible no puede ser negativo.")
                .LessThanOrEqualTo(DatosProductoValidator.StockTope)
                .WithMessage($"El stock disponible no puede superar {DatosProductoValidator.StockTope:N0}.");
        }
    }
}
