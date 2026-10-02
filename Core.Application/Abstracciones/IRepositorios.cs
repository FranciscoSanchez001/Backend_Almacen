using Core.Application.Comun;
using Core.Application.Modelos;
using Core.Domain.Entidades;
using Core.Domain.Enums;

namespace Core.Application.Abstracciones
{
    // Convención: los métodos Obtener*/Listar* devuelven entidades sin seguimiento
    // (.AsNoTracking()), solo para leer. Los *ParaEditar* devuelven entidades con seguimiento,
    // cuyos cambios se guardan con IUnitOfWork.GuardarCambiosAsync.

    public record FiltroUsuarios(
        string? Texto = null,
        RolUsuario? Rol = null,
        bool? Activo = null);

    public interface IUsuarioRepository
    {
        Task<Usuario?> ObtenerAsync(Guid id, CancellationToken ct = default);
        Task<Usuario?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default);
        Task<Pagina<Usuario>> ListarAsync(FiltroUsuarios filtro, int pagina, int tamano, CancellationToken ct = default);
        Task<bool> EmailEnUsoAsync(string email, Guid? exceptoId, CancellationToken ct = default);
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

    public interface IRefreshTokenRepository
    {
        // Con seguimiento. Si el token está activo trae también el usuario (carga explícita).
        Task<RefreshToken?> ObtenerPorHashParaEditarAsync(string tokenHash, DateTime ahora, CancellationToken ct = default);

        // Revoca el token solo si sigue activo, en un único UPDATE condicional: de dos peticiones
        // que rotan el mismo token a la vez, solo una gana. Devuelve false si ya no estaba activo.
        Task<bool> RevocarSiActivoAsync(Guid id, DateTime ahora, Guid? reemplazadoPorId, CancellationToken ct = default);

        // Cierra todas las sesiones del usuario (reutilización detectada).
        Task RevocarTodosDeUsuarioAsync(Guid usuarioId, DateTime ahora, CancellationToken ct = default);

        // Limpieza: borra los tokens del usuario que vencieron hace más de `margen`.
        Task EliminarVencidosDeUsuarioAsync(Guid usuarioId, DateTime ahora, TimeSpan margen, CancellationToken ct = default);

        void Agregar(RefreshToken token);
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
        Task<List<Zona>> ListarTodasAsync(CancellationToken ct = default);
        Task<bool> ExisteActivaAsync(Guid id, CancellationToken ct = default);
        Task<bool> NombreEnUsoAsync(string nombre, Guid? exceptoId, CancellationToken ct = default);
        Task<Zona?> ObtenerParaEditarAsync(Guid id, CancellationToken ct = default);
        void Agregar(Zona zona);
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

        // Inicio de la tienda. Solo cuentan los pedidos que son venta y solo devuelven productos
        // visibles en la tienda (activos con stock), con la categoría cargada.

        // Los más vendidos de toda la tienda, por unidades.
        Task<List<Producto>> ListarMasVendidosAsync(int limite, CancellationToken ct = default);

        // "Los que compras siempre": los que el cliente compró en más pedidos.
        Task<List<Producto>> ListarCompradosFrecuentesAsync(Guid clienteId, int limite, CancellationToken ct = default);

        // "Tus últimas compras": los que el cliente compró más recientemente.
        Task<List<Producto>> ListarCompradosRecientesAsync(Guid clienteId, int limite, CancellationToken ct = default);
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

        // Pedidos asignados o en camino del repartidor.
        Task<int> ContarEnCursoDeRepartidorAsync(Guid repartidorId, CancellationToken ct = default);
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
        Task<Configuracion> ObtenerParaEditarAsync(CancellationToken ct = default);

        // Historial de tasas, la más reciente primero, con el usuario que la cargó.
        Task<Pagina<HistorialTasa>> ListarTasasAsync(int pagina, int tamano, CancellationToken ct = default);
        void AgregarTasa(HistorialTasa tasa);
    }

    // Desde y Hasta filtran por creado_en: desde inclusive, hasta exclusive.
    public record FiltroAuditoria(
        Guid? UsuarioId = null,
        string? Entidad = null,
        Guid? EntidadId = null,
        DateTime? Desde = null,
        DateTime? Hasta = null);

    public record FiltroCambiosEstado(
        Guid? UsuarioId = null,
        Guid? PedidoId = null,
        DateTime? Desde = null,
        DateTime? Hasta = null);

    public interface IAuditoriaRepository
    {
        void Agregar(Auditoria auditoria);

        // Los más recientes primero.
        Task<Pagina<RegistroAuditoria>> ListarAsync(FiltroAuditoria filtro, int pagina, int tamano,
            CancellationToken ct = default);

        // Quién movió cada pedido de estado (historial_estados_pedido), los más recientes primero.
        Task<Pagina<CambioEstadoPedido>> ListarCambiosEstadoAsync(FiltroCambiosEstado filtro, int pagina, int tamano,
            CancellationToken ct = default);
    }

    public interface IMensajeWhatsappRepository
    {
        void Agregar(MensajeWhatsapp mensaje);
    }

    // Datos crudos del dashboard y del informe en Excel; ReportesService calcula los KPIs.
    // Rangos en UTC: desde inclusive, hasta exclusive, sobre pedidos.creado_en.
    public interface IReportesRepository
    {
        // Todos los pedidos creados en el rango, en cualquier estado.
        Task<List<PedidoReporte>> ListarPedidosAsync(DateTime desdeUtc, DateTime hastaUtc, CancellationToken ct = default);

        // Ítems de los pedidos del rango que cuentan como venta.
        Task<List<ItemReporte>> ListarItemsVendidosAsync(DateTime desdeUtc, DateTime hastaUtc, CancellationToken ct = default);

        Task<List<ProductoStock>> ListarProductosActivosAsync(CancellationToken ct = default);

        // Stock disponible que tenía cada producto en `momento`, para los productos que tuvieron
        // movimientos después (disponible_antes del primer movimiento posterior). Los que no
        // aparecen no cambiaron desde entonces: su stock es el actual.
        Task<Dictionary<Guid, int>> StockDisponibleEnAsync(DateTime momentoUtc, CancellationToken ct = default);
    }

    public interface IDiagnosticoBaseDatos
    {
        Task<bool> PuedeConectarAsync(CancellationToken ct = default);
        Task<IEnumerable<string>> MigracionesAplicadasAsync(CancellationToken ct = default);
        Task<IEnumerable<string>> MigracionesPendientesAsync(CancellationToken ct = default);
    }
}
