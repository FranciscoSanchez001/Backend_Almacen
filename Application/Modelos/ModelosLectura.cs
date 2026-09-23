namespace Backend_Almacen.Application.Modelos
{
    // Resultados de consultas que no son una entidad tal cual.

    public record ClienteConPedidos(
        Guid Id,
        string Nombre,
        string Email,
        string? Telefono,
        bool Activo,
        int Pedidos,
        DateTime? UltimoPedido);

    public record RepartidorConCarga(Guid Id, string Nombre, string? Telefono, int PedidosEnCurso);
}
