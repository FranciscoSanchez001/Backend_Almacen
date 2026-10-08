using Core.Domain.Enums;

namespace Core.Application.Dtos
{
    // DTOs de creación y edición del panel. Las reglas están en Validadores/ (FluentValidation).

    public record CategoriaRequest(string Nombre);

    public record CrearZonaRequest(string Nombre);

    public record ActualizarZonaRequest(string Nombre, bool Activa);

    // Rol: solo ventas o repartidor (el superadmin no crea otros superadmin ni clientes).
    public record CrearUsuarioRequest(
        string Nombre,
        string Email,
        string? Telefono,
        RolUsuario Rol,
        string Password);

    // Password es opcional: si viene, reemplaza la contraseña actual.
    public record ActualizarUsuarioRequest(
        string Nombre,
        string Email,
        string? Telefono,
        RolUsuario Rol,
        string? Password);

    // La tasa no va aquí: se carga con PUT /configuracion/tasa para que quede en el historial.
    public record ActualizarConfiguracionRequest(
        string? NumeroSoporte,
        int HorasExpiracion,
        string? DatosTransferencia,
        string? DatosPagoMovil,
        string? WalletBinance,
        List<string>? NumerosPrueba);

    public record TasaRequest(decimal Tasa);

    public record ReponerRequest(int Cantidad);
}
