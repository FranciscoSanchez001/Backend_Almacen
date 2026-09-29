using Core.Application.Dtos;
using FluentValidation;

namespace Core.Application.Validadores
{
    public class LoginValidator : AbstractValidator<LoginDto>
    {
        public LoginValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("El correo es obligatorio.")
                .EmailAddress().WithMessage("El correo no tiene un formato válido.")
                .MaximumLength(254).WithMessage("El correo admite como máximo 254 caracteres.");
            RuleFor(x => x.Password)
                .NotEmpty().WithMessage("La contraseña es obligatoria.")
                .MaximumLength(128).WithMessage("La contraseña admite como máximo 128 caracteres.");
        }
    }

    public class GoogleLoginValidator : AbstractValidator<GoogleLoginDto>
    {
        public GoogleLoginValidator()
        {
            RuleFor(x => x.IdToken).NotEmpty().WithMessage("El ID token de Google es obligatorio.");
        }
    }
}
