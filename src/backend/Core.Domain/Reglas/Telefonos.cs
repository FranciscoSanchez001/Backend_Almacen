using System.Text.RegularExpressions;

namespace Core.Domain.Reglas
{
    public static partial class Telefonos
    {
        // Celulares venezolanos: +58 4XX XXX XXXX. Acepta también 04XX..., 4XX... y con
        // espacios, guiones o paréntesis. Devuelve el formato +584XXXXXXXXX, o null si no es válido.
        public static string? NormalizarVenezolano(string? telefono)
        {
            if (string.IsNullOrWhiteSpace(telefono))
            {
                return null;
            }

            var digitos = NoDigitos().Replace(telefono, "");
            if (digitos.StartsWith("58"))
            {
                digitos = digitos[2..];
            }
            if (digitos.StartsWith('0'))
            {
                digitos = digitos[1..];
            }

            return digitos.Length == 10 && digitos[0] == '4' ? "+58" + digitos : null;
        }

        [GeneratedRegex(@"\D")]
        private static partial Regex NoDigitos();
    }
}
