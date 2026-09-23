using Backend_Almacen.Domain.Enums;

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

    // Fila de auditoría con el nombre del usuario y, si se puede, el de la entidad afectada
    // (producto, categoría, zona o usuario). DatosAntes / DatosDespues son JSON.
    public record RegistroAuditoria(
        Guid Id,
        Guid UsuarioId,
        string Usuario,
        string Entidad,
        Guid? EntidadId,
        string? EntidadNombre,
        AccionAuditoria Accion,
        string? DatosAntes,
        string? DatosDespues,
        DateTime CreadoEn);

    // UsuarioId / Usuario son null cuando el cambio lo hizo el sistema (job de expiración).
    public record CambioEstadoPedido(
        Guid Id,
        Guid PedidoId,
        int NumeroPedido,
        EstadoPedido? EstadoAnterior,
        EstadoPedido EstadoNuevo,
        Guid? UsuarioId,
        string? Usuario,
        DateTime CreadoEn);
}
