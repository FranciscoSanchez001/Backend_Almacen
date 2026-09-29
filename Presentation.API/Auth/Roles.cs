using Core.Domain.Enums;

namespace Presentation.API.Auth
{
    // Valores del claim "role" del JWT. Coinciden con el enum rol_usuario de la base de datos.
    public static class Roles
    {
        public const string Cliente = "cliente";
        public const string Ventas = "ventas";
        public const string Repartidor = "repartidor";
        public const string Superadmin = "superadmin";

        // Matriz RBAC de la Fase 3 (Admin / Employee) sobre los roles del negocio:
        //   Admin    = superadmin: todo, incluido borrar y gestionar categorías, usuarios y configuración.
        //   Employee = ventas: consulta catálogos, registra y edita productos, gestiona pedidos.
        //              No puede borrar (DELETE -> 403 Forbidden) ni crear/editar categorías.
        public const string Admin = Superadmin;
        public const string Employee = Ventas;

        // Para [Authorize(Roles = ...)]: cualquiera de los roles listados.
        public const string Personal = Employee + "," + Admin;

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
