namespace Backend_Almacen.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public required string Nombre { get; set; }
        public required string Email { get; set; }
        public string? Telefono { get; set; }
        public RolUsuario Rol { get; set; }

        // Solo clientes (login con Google).
        public string? GoogleId { get; set; }

        // Solo personal (superadmin, ventas, repartidor). Hash bcrypt.
        public string? PasswordHash { get; set; }

        public bool Activo { get; set; } = true;
        public DateTime CreadoEn { get; set; }
    }
}
