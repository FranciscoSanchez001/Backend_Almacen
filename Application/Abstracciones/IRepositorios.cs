using Backend_Almacen.Application.Comun;
using Backend_Almacen.Application.Modelos;
using Backend_Almacen.Domain.Entidades;
using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Application.Abstracciones
{
    // Convención: los métodos Obtener*/Listar* devuelven entidades sin seguimiento
    // (.AsNoTracking()), solo para leer. Los *ParaEditar* devuelven entidades con seguimiento,
    // cuyos cambios se guardan con IUnitOfWork.GuardarCambiosAsync.

    public interface IUsuarioRepository
    {
        Task<Usuario?> ObtenerAsync(Guid id, CancellationToken ct = default);
        Task<Usuario?> ObtenerPersonalPorEmailAsync(string email, CancellationToken ct = default);
        Task<Usuario?> ObtenerPorGoogleIdParaEditarAsync(string googleId, CancellationToken ct = default);
        Task<Usuario?> ObtenerPorEmailParaEditarAsync(string email, CancellationToken ct = default);
        Task<bool> ExisteActivoAsync(Guid id, CancellationToken ct = default);
        Task<bool> ExisteActivoConRolAsync(Guid id, RolUsuario rol, CancellationToken ct = default);
        Task<bool> ExisteConRolAsync(Guid id, RolUsuario rol, CancellationToken ct = default);
        Task<bool> ExisteSuperadminAsync(CancellationToken ct = default);
        Task AsignarTelefonoSiVacioAsync(Guid id, string telefono, CancellationToken ct = default);
        Task<List<RepartidorConCarga>> ListarRepartidoresActivosAsync(CancellationToken ct = default);
        Task<Pagina<ClienteConPedidos>> BuscarClientesAsync(string? texto, int pagina, int tamano, CancellationToken ct = default);
        void Agregar(Usuario usuario);
    }

    public interface ICategoriaRepository
    {
        Task<List<Categoria>> ListarAsync(CancellationToken ct = default);
        Task<bool> ExisteAsync(Guid id, CancellationToken ct = default);
        Task<bool> NombreEnUsoAsync(string nombre, Guid? exceptoId, CancellationToken ct = default);
        Task<Categoria?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default);
        void Agregar(Categoria categoria);
    }

    public interface IZonaRepository
    {
        Task<List<Zona>> ListarActivasAsync(CancellationToken ct = default);
        Task<bool> ExisteActivaAsync(Guid id, CancellationToken ct = default);
    }

    public record FiltroProductos(
        string? Texto = null,
        Guid? CategoriaId = null,
        bool IncluirInactivos = false,
        // Catálogo público: solo activos con stock disponible.
        bool SoloVisiblesEnTienda = false);

    public interface IProductoRepository
    {
        Task<Pagina<Producto>> ListarAsync(FiltroProductos filtro, int pagina, int tamano, CancellationToken ct = default);
        Task<List<Producto>> ListarInventarioAsync(string? texto, Guid? categoriaId, bool soloAgotados, CancellationToken ct = default);
        Task<Producto?> ObtenerAsync(Guid id, bool soloVisiblesEnTienda = false, CancellationToken ct = default);
        Task<Producto?> ObtenerActivoParaEditarAsync(Guid id, CancellationToken ct = default);
        Task<Dictionary<Guid, Producto>> ObtenerActivosAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default);
        Task<bool> ExisteAsync(Guid id, CancellationToken ct = default);
        Task<bool> SkuEnUsoAsync(string sku, Guid? exceptoId, CancellationToken ct = default);
        void Agregar(Producto producto);
    }

    // Operaciones atómicas de stock: cada una es un único UPDATE condicional sobre productos que
    // devuelve el stock disponible resultante, o null si la condición no se cumplió.
    public interface IInventarioRepository
    {
        // disponible − q, reservado + q, solo si disponible ≥ q y el producto está activo.
        Task<int?> ReservarAsync(Guid productoId, int cantidad, CancellationToken ct = default);

        // reservado − q, solo si reservado ≥ q.
        Task<int?> ConfirmarVentaAsync(Guid productoId, int cantidad, CancellationToken ct = default);

        // disponible + q, reservado − q, solo si reservado ≥ q.
        Task<int?> LiberarAsync(Guid productoId, int cantidad, CancellationToken ct = default);

        // disponible + q, solo si el producto está activo.
        Task<int?> ReponerAsync(Guid productoId, int cantidad, CancellationToken ct = default);

        // disponible = nuevo, solo si el disponible sigue siendo el esperado.
        Task<bool> AjustarAsync(Guid productoId, int disponibleEsperado, int disponibleNuevo, CancellationToken ct = default);

        void AgregarMovimiento(MovimientoInventario movimiento);
        Task<Pagina<MovimientoInventario>> ListarMovimientosAsync(Guid productoId, int pagina, int tamano, CancellationToken ct = default);
    }

    public enum OrdenPedidos
    {
        MasRecientes,
        // Pendientes: primero los más cerca de vencer.
        MasUrgentes,
        // Repartidor: en el orden en que se le asignaron.
        PorAsignacion,
        // Historial del repartidor: últimas entregas primero.
        PorEntrega
    }

    public record FiltroPedidos(
        IReadOnlyCollection<EstadoPedido>? Estados = null,
        Guid? ClienteId = null,
        Guid? RepartidorId = null,
        Guid? ZonaId = null,
        DateTime? Desde = null,
        DateTime? Hasta = null,
        OrdenPedidos Orden = OrdenPedidos.MasRecientes);

    public interface IPedidoRepository
    {
        // Con cliente, zona, revisor, repartidor, ítems (producto y categoría) e historial.
        Task<Pedido?> ObtenerDetalleAsync(Guid id, CancellationToken ct = default);
        Task<Pagina<Pedido>> ListarAsync(FiltroPedidos filtro, int pagina, int tamano, CancellationToken ct = default);

        // Bloquea la fila (SELECT ... FOR UPDATE) hasta el fin de la transacción y la devuelve con
        // seguimiento, con ítems, cliente y zona.
        Task<Pedido?> BloquearParaActualizarAsync(Guid id, CancellationToken ct = default);

        Task<List<Guid>> ListarIdsVencidosAsync(DateTime ahora, int maximo, CancellationToken ct = default);
        Task<List<Guid>> ListarIdsPorExpirarSinAvisoAsync(DateTime ahora, DateTime limite, CancellationToken ct = default);
        void Agregar(Pedido pedido);
    }

    public interface INotificacionRepository
    {
        Task<Pagina<Notificacion>> ListarAsync(bool soloNoLeidas, int pagina, int tamano, CancellationToken ct = default);
        Task<bool> MarcarLeidaAsync(Guid id, CancellationToken ct = default);
        Task MarcarTodasLeidasAsync(CancellationToken ct = default);
        Task MarcarAgotadoResueltoAsync(Guid productoId, CancellationToken ct = default);
        void Agregar(Notificacion notificacion);
    }

    public interface IConfiguracionRepository
    {
        Task<Configuracion> ObtenerAsync(CancellationToken ct = default);
    }

    public interface IAuditoriaRepository
    {
        void Agregar(Auditoria auditoria);
    }

    public interface IMensajeWhatsappRepository
    {
        void Agregar(MensajeWhatsapp mensaje);
    }

    public interface IDiagnosticoBaseDatos
    {
        Task<bool> PuedeConectarAsync(CancellationToken ct = default);
        Task<IEnumerable<string>> MigracionesAplicadasAsync(CancellationToken ct = default);
        Task<IEnumerable<string>> MigracionesPendientesAsync(CancellationToken ct = default);
    }
}
