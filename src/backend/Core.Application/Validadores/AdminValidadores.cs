using Core.Application.Dtos;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using FluentValidation;

namespace Core.Application.Validadores
{
    public class CategoriaValidator : AbstractValidator<CategoriaRequest>
    {
        public CategoriaValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la categoría es obligatorio.")
                .MaximumLength(100).WithMessage("El nombre de la categoría admite como máximo 100 caracteres.");
        }
    }

    public class CrearZonaValidator : AbstractValidator<CrearZonaRequest>
    {
        public CrearZonaValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la zona es obligatorio.")
                .MaximumLength(100).WithMessage("El nombre de la zona admite como máximo 100 caracteres.");
        }
    }

    public class ActualizarZonaValidator : AbstractValidator<ActualizarZonaRequest>
    {
        public ActualizarZonaValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la zona es obligatorio.")
                .MaximumLength(100).WithMessage("El nombre de la zona admite como máximo 100 caracteres.");
        }
    }

    // Reglas del personal que gestiona el superadmin (vendedores y repartidores).
    internal static class ReglasUsuario
    {
        // bcrypt solo usa los primeros 72 bytes de la contraseña.
        public const int PasswordMinimo = 8;
        public const int PasswordMaximo = 72;

        public static bool EsRolGestionable(RolUsuario rol) => rol is RolUsuario.Ventas or RolUsuario.Repartidor;

        public static bool EsTelefonoValido(string? telefono) =>
            string.IsNullOrWhiteSpace(telefono) || Telefonos.NormalizarVenezolano(telefono) is not null;
    }

    public class CrearUsuarioValidator : AbstractValidator<CrearUsuarioRequest>
    {
        public CrearUsuarioValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio.")
                .MaximumLength(150).WithMessage("El nombre admite como máximo 150 caracteres.");
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("El correo es obligatorio.")
                .EmailAddress().WithMessage("El correo no tiene un formato válido.")
                .MaximumLength(254).WithMessage("El correo admite como máximo 254 caracteres.");
            RuleFor(x => x.Telefono)
                .Must(ReglasUsuario.EsTelefonoValido)
                .WithMessage("El teléfono debe ser un celular venezolano (+58 4XX XXX XXXX).");
            RuleFor(x => x.Rol)
                .IsInEnum().WithMessage("El rol no es válido.")
                .Must(ReglasUsuario.EsRolGestionable).WithMessage("El rol debe ser ventas o repartidor.");
            RuleFor(x => x.Password)
                .NotEmpty().WithMessage("La contraseña es obligatoria.")
                .Length(ReglasUsuario.PasswordMinimo, ReglasUsuario.PasswordMaximo)
                .WithMessage($"La contraseña debe tener entre {ReglasUsuario.PasswordMinimo} y {ReglasUsuario.PasswordMaximo} caracteres.");
        }
    }

    public class ActualizarUsuarioValidator : AbstractValidator<ActualizarUsuarioRequest>
    {
        public ActualizarUsuarioValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio.")
                .MaximumLength(150).WithMessage("El nombre admite como máximo 150 caracteres.");
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("El correo es obligatorio.")
                .EmailAddress().WithMessage("El correo no tiene un formato válido.")
                .MaximumLength(254).WithMessage("El correo admite como máximo 254 caracteres.");
            RuleFor(x => x.Telefono)
                .Must(ReglasUsuario.EsTelefonoValido)
                .WithMessage("El teléfono debe ser un celular venezolano (+58 4XX XXX XXXX).");
            RuleFor(x => x.Rol)
                .IsInEnum().WithMessage("El rol no es válido.")
                .Must(ReglasUsuario.EsRolGestionable).WithMessage("El rol debe ser ventas o repartidor.");
            RuleFor(x => x.Password)
                .Length(ReglasUsuario.PasswordMinimo, ReglasUsuario.PasswordMaximo)
                .WithMessage($"La contraseña debe tener entre {ReglasUsuario.PasswordMinimo} y {ReglasUsuario.PasswordMaximo} caracteres.")
                .When(x => !string.IsNullOrEmpty(x.Password));
        }
    }

    public class ActualizarConfiguracionValidator : AbstractValidator<ActualizarConfiguracionRequest>
    {
        public ActualizarConfiguracionValidator()
        {
            RuleFor(x => x.NumeroSoporte)
                .MaximumLength(20).WithMessage("El número de soporte admite como máximo 20 caracteres.");
            RuleFor(x => x.HorasExpiracion)
                .InclusiveBetween(1, 168).WithMessage("Las horas de expiración deben estar entre 1 y 168 (una semana).");
            RuleFor(x => x.DatosTransferencia)
                .MaximumLength(1000).WithMessage("Los datos de transferencia admiten como máximo 1000 caracteres.");
            RuleFor(x => x.DatosPagoMovil)
                .MaximumLength(1000).WithMessage("Los datos de pago móvil admiten como máximo 1000 caracteres.");
            RuleFor(x => x.WalletBinance)
                .MaximumLength(200).WithMessage("La wallet de Binance admite como máximo 200 caracteres.");
            RuleFor(x => x.NumerosPrueba)
                .Must(n => n is null || n.Count <= 20).WithMessage("Se admiten como máximo 20 números de prueba.");
        }
    }

    public class TasaValidator : AbstractValidator<TasaRequest>
    {
        public TasaValidator()
        {
            RuleFor(x => x.Tasa)
                .GreaterThan(0).WithMessage("La tasa debe ser mayor que 0.")
                .LessThanOrEqualTo(1_000_000_000m).WithMessage("La tasa no es razonable.");
        }
    }

    public class ReponerValidator : AbstractValidator<ReponerRequest>
    {
        public ReponerValidator()
        {
            RuleFor(x => x.Cantidad)
                .GreaterThan(0).WithMessage("La cantidad a reponer debe ser mayor que 0.")
                .LessThanOrEqualTo(DatosProductoValidator.StockTope)
                .WithMessage($"La cantidad a reponer no puede superar {DatosProductoValidator.StockTope:N0}.");
        }
    }
}
