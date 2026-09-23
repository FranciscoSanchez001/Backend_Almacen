using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.WebAPI.Auth
{
    // Valores del claim "role" del JWT. Coinciden con el enum rol_usuario de la base de datos.
    public static class Roles
    {
        public const string Cliente = "cliente";
        public const string Ventas = "ventas";
        public const string Repartidor = "repartidor";
        public const string Superadmin = "superadmin";

        // Para [Authorize(Roles = ...)]: cualquiera de los roles listados.
        public const string Personal = Ventas + "," + Superadmin;

        public static string De(RolUsuario rol) => rol switch
        {
            RolUsuario.Cliente => Cliente,
            RolUsuario.Ventas => Ventas,
            RolUsuario.Repartidor => Repartidor,
            RolUsuario.Superadmin => Superadmin,
            _ => throw new ArgumentOutOfRangeException(nameof(rol))
        };
    }
}
