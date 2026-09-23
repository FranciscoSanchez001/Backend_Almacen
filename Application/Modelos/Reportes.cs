using Backend_Almacen.Domain.Enums;

namespace Backend_Almacen.Application.Modelos
{
    // ---- Período ----

    public enum TipoReporte
    {
        Diario,
        Semanal,
        Mensual,
        Personalizado
    }

    // Fechas locales (zona horaria de la tienda), ambas inclusive. DesdeUtc / HastaUtc es el
    // rango equivalente en UTC: desde inclusive, hasta exclusive.
    public record Periodo(TipoReporte Tipo, DateOnly Desde, DateOnly Hasta, DateTime DesdeUtc, DateTime HastaUtc)
    {
        public int Dias => Hasta.DayNumber - Desde.DayNumber + 1;
    }

    // ---- Filas que trae el repositorio ----

    // Todos los pedidos creados en el período, en cualquier estado.
    public record PedidoReporte(
        Guid Id,
        int Numero,
        EstadoPedido Estado,
        MetodoPago MetodoPago,
        MonedaPago MonedaPago,
        decimal TasaCambio,
        decimal TotalUsd,
        decimal TotalBs,
        Guid ClienteId,
        string Cliente,
        Guid ZonaId,
        string Zona,
        double? Latitud,
        double? Longitud,
        Guid? RepartidorId,
        string? Repartidor,
        DateTime CreadoEn,
        DateTime? RevisadoEn,
        DateTime? AsignadoEn,
        DateTime? EntregadoEn);

    // Ítems de los pedidos del período que cuentan como venta. Categoría congelada en el ítem.
    public record ItemReporte(
        Guid PedidoId,
        Guid ProductoId,
        string Producto,
        Guid CategoriaId,
        string Categoria,
        int Cantidad,
        decimal PrecioUsd,
        decimal PrecioBs);

    // Productos activos con su stock actual.
    public record ProductoStock(Guid Id, string Nombre, string Categoria, int StockDisponible, int StockReservado);

    // ---- Resultado: KPIs ----

    public record Kpis(
        PeriodoKpis Periodo,
        ResumenVentas Resumen,
        IReadOnlyList<VentasEnPeriodo> VentasPorDia,
        IReadOnlyList<VentasEnPeriodo> VentasPorSemana,
        IReadOnlyList<VentasEnPeriodo> VentasPorMes,
        IReadOnlyList<VentaProducto> Productos,
        IReadOnlyList<VentaProducto> MasVendidos,
        IReadOnlyList<VentaProducto> MasVendidosPorIngresos,
        IReadOnlyList<VentaProducto> MenosVendidos,
        IReadOnlyList<VentaCategoria> Categorias,
        VentasPorMetodoPago MetodosPago,
        HorasPico HorasPico,
        IReadOnlyList<VentaZona> Zonas,
        IReadOnlyList<PuntoEntrega> PuntosEntrega,
        OperacionPedidos Operacion,
        InventarioKpis Inventario,
        IReadOnlyList<EntregasRepartidor> Repartidores);

    // EnCurso: el período incluye hoy y todavía no terminó; entonces el anterior tiene
    // DiasComparados días (los transcurridos, hoy incluido) en lugar de la duración completa.
    public record PeriodoKpis(
        TipoReporte Tipo,
        DateOnly Desde,
        DateOnly Hasta,
        DateOnly AnteriorDesde,
        DateOnly AnteriorHasta,
        bool EnCurso,
        int DiasComparados,
        string ZonaHoraria,
        DateTime GeneradoEn,
        DateTime GeneradoEnLocal);

    public record CifrasVentas(decimal VentasUsd, decimal VentasBs, int Pedidos, int Unidades, decimal TicketPromedioUsd,
        decimal UnidadesPorPedido);

    // Crecimiento: (actual − anterior) ÷ anterior × 100; null si el anterior es 0.
    public record ResumenVentas(
        CifrasVentas Actual,
        CifrasVentas Anterior,
        decimal? CrecimientoVentasPct,
        decimal? CrecimientoPedidosPct,
        decimal? CrecimientoTicketPct);

    // Inicio: primer día del bucket (el día, el lunes de la semana o el día 1 del mes).
    public record VentasEnPeriodo(DateOnly Inicio, int Pedidos, int Unidades, decimal VentasUsd, decimal VentasBs,
        decimal TicketPromedioUsd);

    // Posicion: lugar en el ranking por unidades (1 = el más vendido).
    public record VentaProducto(int Posicion, Guid ProductoId, string Producto, string Categoria, int Unidades,
        decimal IngresosUsd);

    public record VentaCategoria(Guid CategoriaId, string Categoria, int Unidades, decimal IngresosUsd, decimal Porcentaje);

    // MontoMoneda: lo que entra en la moneda del método (Bs para transferencia y pago móvil,
    // USDT para Binance).
    public record VentaMetodoPago(MetodoPago Metodo, MonedaPago Moneda, int Pedidos, decimal MontoUsd, decimal MontoMoneda,
        decimal Porcentaje);

    public record VentasPorMetodoPago(IReadOnlyList<VentaMetodoPago> Metodos, decimal EntraBs, decimal EntraUsdt);

    // Pedidos[dia][hora]: dia 0 = lunes ... 6 = domingo; hora local 0..23.
    public record HorasPico(int[][] Pedidos, IReadOnlyList<string> Dias);

    public record VentaZona(Guid ZonaId, string Zona, int Pedidos, decimal IngresosUsd, decimal Porcentaje);

    public record PuntoEntrega(Guid PedidoId, int Numero, Guid ZonaId, string Zona, double Latitud, double Longitud,
        decimal TotalUsd);

    // Porcentajes sobre los pedidos ya resueltos (aprobados + rechazados + expirados); los
    // pendientes se informan aparte. Tiempos en minutos.
    public record OperacionPedidos(
        int Total,
        int Aprobados,
        int Rechazados,
        int Expirados,
        int Pendientes,
        decimal? PorcentajeAprobados,
        decimal? PorcentajeRechazados,
        decimal? PorcentajeExpirados,
        double? TiempoPromedioAprobacionMin,
        double? TiempoPromedioEntregaMin);

    // Rotación = unidades vendidas ÷ stock disponible promedio del período (promedio entre el
    // stock al inicio y al final). Null si el stock promedio es 0.
    public record InventarioProducto(Guid ProductoId, string Producto, string Categoria, int StockDisponible,
        int StockReservado, int UnidadesVendidas, decimal StockPromedio, decimal? Rotacion, bool Agotado);

    public record InventarioKpis(IReadOnlyList<InventarioProducto> Productos, IReadOnlyList<InventarioProducto> SinStock,
        decimal? RotacionGlobal);

    public record EntregasRepartidor(Guid RepartidorId, string Repartidor, int Entregas, double? TiempoPromedioEntregaMin);

    // ---- Resultado: informe en Excel ----

    // Una fila por producto vendido. Fecha y hora en la zona horaria de la tienda.
    public record DetalleVenta(
        int NumeroPedido,
        DateTime FechaHoraLocal,
        EstadoPedido Estado,
        string Cliente,
        string Zona,
        MetodoPago MetodoPago,
        string Producto,
        string Categoria,
        int Cantidad,
        decimal PrecioUsd,
        decimal PrecioBs,
        decimal Tasa);

    public record DatosReporte(Kpis Kpis, IReadOnlyList<DetalleVenta> Detalle);
}
