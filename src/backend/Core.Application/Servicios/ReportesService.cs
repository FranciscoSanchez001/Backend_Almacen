using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Domain.Enums;
using Core.Domain.Reglas;

namespace Core.Application.Servicios
{
    public class ReportesOptions
    {
        // Zona horaria de la tienda: define qué es "hoy", en qué día cae cada venta y las horas pico.
        public string ZonaHoraria { get; set; } = "America/Caracas";

        // Tope para los rangos personalizados.
        public int DiasMaximos { get; set; } = 366;
    }

    public record ResultadoPeriodo(Periodo? Periodo, string? Error = null);

    // KPIs del dashboard e informe en Excel. Los dos salen de CalcularAsync, así que los números
    // del Excel siempre coinciden con los de la pantalla.
    //
    // Solo cuentan como venta los pedidos aprobados, asignados, en camino o entregados
    // (TransicionesPedido.CuentanComoVenta), según su fecha de creación. Los montos van en USD
    // y el equivalente en Bs es el que quedó congelado en cada pedido.
    //
    // El repositorio trae los pedidos e ítems del período y aquí se agregan en memoria: así
    // los días, semanas y horas pico se calculan en la hora local de la tienda y no en UTC.
    public class ReportesService(IReportesRepository reportes, ReportesOptions options)
    {
        private static readonly string[] NombresDias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

        private readonly TimeZoneInfo zona = TimeZoneInfo.FindSystemTimeZoneById(options.ZonaHoraria);

        public DateOnly Hoy() => DateOnly.FromDateTime(Local(DateTime.UtcNow));

        // Sin tipo ni fechas: el mes en curso. Sin tipo pero con fechas: personalizado.
        // Diario, semanal y mensual toman el día, la semana (lunes a domingo) o el mes de `desde`
        // (hoy si no viene) e ignoran `hasta`.
        public ResultadoPeriodo ResolverPeriodo(TipoReporte? tipo, DateOnly? desde, DateOnly? hasta)
        {
            tipo ??= desde is null && hasta is null ? TipoReporte.Mensual : TipoReporte.Personalizado;
            var fecha = desde ?? Hoy();

            switch (tipo)
            {
                case TipoReporte.Diario:
                    return new(Crear(tipo.Value, fecha, fecha));
                case TipoReporte.Semanal:
                    var lunes = fecha.AddDays(-(((int)fecha.DayOfWeek + 6) % 7));
                    return new(Crear(tipo.Value, lunes, lunes.AddDays(6)));
                case TipoReporte.Mensual:
                    var primero = new DateOnly(fecha.Year, fecha.Month, 1);
                    return new(Crear(tipo.Value, primero, primero.AddMonths(1).AddDays(-1)));
                default:
                    if (desde is null || hasta is null)
                    {
                        return new(null, "Para un período personalizado hay que indicar desde y hasta.");
                    }
                    if (desde > hasta)
                    {
                        return new(null, "desde no puede ser posterior a hasta.");
                    }
                    if (hasta.Value.DayNumber - desde.Value.DayNumber + 1 > options.DiasMaximos)
                    {
                        return new(null, $"El período no puede superar {options.DiasMaximos} días.");
                    }
                    return new(Crear(TipoReporte.Personalizado, desde.Value, hasta.Value));
            }
        }

        public async Task<Kpis> CalcularKpisAsync(Periodo periodo, CancellationToken ct = default) =>
            (await CalcularAsync(periodo, ct)).Kpis;

        public async Task<DatosReporte> CalcularAsync(Periodo periodo, CancellationToken ct = default)
        {
            // Período anterior de igual duración, justo antes. Si el período todavía no terminó
            // (p. ej. "este mes" a día 23), se compara contra los mismos días transcurridos: si no,
            // 23 días de ventas contra 30 darían siempre un crecimiento negativo engañoso.
            var hoy = Hoy();
            var enCurso = periodo.Desde <= hoy && hoy < periodo.Hasta;
            var diasComparados = enCurso ? hoy.DayNumber - periodo.Desde.DayNumber + 1 : periodo.Dias;
            var anterior = Crear(periodo.Tipo, periodo.Desde.AddDays(-diasComparados), periodo.Desde.AddDays(-1));
            var ahora = DateTime.UtcNow;

            // Consultas en serie: comparten el DbContext de la petición.
            var pedidos = await reportes.ListarPedidosAsync(periodo.DesdeUtc, periodo.HastaUtc, ct);
            var items = await reportes.ListarItemsVendidosAsync(periodo.DesdeUtc, periodo.HastaUtc, ct);
            var pedidosAnteriores = await reportes.ListarPedidosAsync(anterior.DesdeUtc, anterior.HastaUtc, ct);
            var itemsAnteriores = await reportes.ListarItemsVendidosAsync(anterior.DesdeUtc, anterior.HastaUtc, ct);
            var productos = await reportes.ListarProductosActivosAsync(ct);
            var stockInicio = await reportes.StockDisponibleEnAsync(Min(periodo.DesdeUtc, ahora), ct);
            var stockFin = await reportes.StockDisponibleEnAsync(Min(periodo.HastaUtc, ahora), ct);

            var ventas = pedidos.Where(EsVenta).ToList();
            // Si un pedido se aprobó entre las dos consultas, sus ítems llegan sin el pedido como
            // venta: se descartan para que todos los KPIs vean el mismo conjunto de pedidos.
            items = SoloDe(ventas, items);
            itemsAnteriores = SoloDe(pedidosAnteriores.Where(EsVenta), itemsAnteriores);
            var unidadesPorPedido = items.GroupBy(i => i.PedidoId).ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));

            var actual = Cifras(ventas, items);
            var previo = Cifras(pedidosAnteriores.Where(EsVenta).ToList(), itemsAnteriores);
            var resumen = new ResumenVentas(actual, previo,
                Crecimiento(actual.VentasUsd, previo.VentasUsd),
                Crecimiento(actual.Pedidos, previo.Pedidos),
                Crecimiento(actual.TicketPromedioUsd, previo.TicketPromedioUsd));

            var porDia = VentasPorDia(periodo, ventas, unidadesPorPedido);
            var ranking = RankingProductos(items, productos);

            var kpis = new Kpis(
                new PeriodoKpis(periodo.Tipo, periodo.Desde, periodo.Hasta, anterior.Desde, anterior.Hasta, enCurso,
                    diasComparados, options.ZonaHoraria, ahora, Local(ahora)),
                resumen,
                porDia,
                Agrupar(porDia, d => d.AddDays(-(((int)d.DayOfWeek + 6) % 7))),
                Agrupar(porDia, d => new DateOnly(d.Year, d.Month, 1)),
                ranking,
                ranking.Take(10).ToList(),
                ranking.OrderByDescending(p => p.IngresosUsd).ThenBy(p => p.Posicion).Take(10).ToList(),
                ranking.AsEnumerable().Reverse().Take(10).ToList(),
                Categorias(items),
                MetodosPago(ventas, actual.VentasUsd),
                HorasPico(ventas),
                Zonas(ventas, actual.VentasUsd),
                ventas.Where(p => p.Latitud is not null && p.Longitud is not null)
                    .Select(p => new PuntoEntrega(p.Id, p.Numero, p.ZonaId, p.Zona, p.Latitud!.Value, p.Longitud!.Value, p.TotalUsd))
                    .ToList(),
                Operacion(pedidos),
                Inventario(productos, items, stockInicio, stockFin),
                Repartidores(pedidos));

            var pedidosPorId = ventas.ToDictionary(p => p.Id);
            var detalle = items
                .Select(i => (Item: i, Pedido: pedidosPorId[i.PedidoId]))
                .OrderBy(x => x.Pedido.Numero).ThenBy(x => x.Item.Producto)
                .Select(x => new DetalleVenta(x.Pedido.Numero, Local(x.Pedido.CreadoEn), x.Pedido.Estado, x.Pedido.Cliente,
                    x.Pedido.Zona, x.Pedido.MetodoPago, x.Item.Producto, x.Item.Categoria, x.Item.Cantidad,
                    x.Item.PrecioUsd, x.Item.PrecioBs, x.Pedido.TasaCambio))
                .ToList();

            return new DatosReporte(kpis, detalle);
        }

        // ---- Cálculos ----

        private static bool EsVenta(PedidoReporte p) => TransicionesPedido.CuentanComoVenta.Contains(p.Estado);

        private static List<ItemReporte> SoloDe(IEnumerable<PedidoReporte> ventas, List<ItemReporte> items)
        {
            var ids = ventas.Select(p => p.Id).ToHashSet();
            return items.Where(i => ids.Contains(i.PedidoId)).ToList();
        }

        private static CifrasVentas Cifras(List<PedidoReporte> ventas, List<ItemReporte> items)
        {
            var usd = ventas.Sum(p => p.TotalUsd);
            var unidades = items.Sum(i => i.Cantidad);
            return new CifrasVentas(usd, ventas.Sum(p => p.TotalBs), ventas.Count, unidades,
                Dividir(usd, ventas.Count), Dividir(unidades, ventas.Count));
        }

        // Un punto por día del período, también los días sin ventas (la línea de tiempo no se corta).
        private List<VentasEnPeriodo> VentasPorDia(Periodo periodo, List<PedidoReporte> ventas,
            Dictionary<Guid, int> unidadesPorPedido)
        {
            var porFecha = ventas.GroupBy(p => DateOnly.FromDateTime(Local(p.CreadoEn))).ToDictionary(g => g.Key, g => g.ToList());
            return Enumerable.Range(0, periodo.Dias)
                .Select(periodo.Desde.AddDays)
                .Select(dia =>
                {
                    var delDia = porFecha.GetValueOrDefault(dia) ?? [];
                    var usd = delDia.Sum(p => p.TotalUsd);
                    return new VentasEnPeriodo(dia, delDia.Count, delDia.Sum(p => unidadesPorPedido.GetValueOrDefault(p.Id)),
                        usd, delDia.Sum(p => p.TotalBs), Dividir(usd, delDia.Count));
                })
                .ToList();
        }

        private static List<VentasEnPeriodo> Agrupar(List<VentasEnPeriodo> porDia, Func<DateOnly, DateOnly> inicio) =>
            porDia.GroupBy(d => inicio(d.Inicio))
                .Select(g =>
                {
                    var pedidos = g.Sum(d => d.Pedidos);
                    var usd = g.Sum(d => d.VentasUsd);
                    return new VentasEnPeriodo(g.Key, pedidos, g.Sum(d => d.Unidades), usd, g.Sum(d => d.VentasBs),
                        Dividir(usd, pedidos));
                })
                .ToList();

        // Todos los productos activos (los que no vendieron nada quedan al final con 0) más los
        // borrados que sí vendieron en el período. Orden: unidades, ingresos, nombre.
        private static List<VentaProducto> RankingProductos(List<ItemReporte> items, List<ProductoStock> productos)
        {
            var vendidos = items.GroupBy(i => i.ProductoId)
                .ToDictionary(g => g.Key, g => (g.First().Producto, g.First().Categoria, Unidades: g.Sum(i => i.Cantidad),
                    Ingresos: g.Sum(i => i.PrecioUsd * i.Cantidad)));
            foreach (var p in productos.Where(p => !vendidos.ContainsKey(p.Id)))
            {
                vendidos[p.Id] = (p.Nombre, p.Categoria, 0, 0m);
            }

            return vendidos
                .OrderByDescending(v => v.Value.Unidades).ThenByDescending(v => v.Value.Ingresos).ThenBy(v => v.Value.Producto)
                .Select((v, i) => new VentaProducto(i + 1, v.Key, v.Value.Producto, v.Value.Categoria, v.Value.Unidades,
                    v.Value.Ingresos))
                .ToList();
        }

        private static List<VentaCategoria> Categorias(List<ItemReporte> items)
        {
            var total = items.Sum(i => i.PrecioUsd * i.Cantidad);
            return items.GroupBy(i => i.CategoriaId)
                .Select(g =>
                {
                    var ingresos = g.Sum(i => i.PrecioUsd * i.Cantidad);
                    return new VentaCategoria(g.Key, g.First().Categoria, g.Sum(i => i.Cantidad), ingresos, Porcentaje(ingresos, total));
                })
                .OrderByDescending(c => c.IngresosUsd).ThenBy(c => c.Categoria)
                .ToList();
        }

        // Los tres métodos siempre, aunque alguno no tenga ventas.
        private static VentasPorMetodoPago MetodosPago(List<PedidoReporte> ventas, decimal totalUsd)
        {
            var metodos = Enum.GetValues<MetodoPago>()
                .Select(m =>
                {
                    var moneda = m == MetodoPago.Binance ? MonedaPago.Usdt : MonedaPago.Ves;
                    var delMetodo = ventas.Where(p => p.MetodoPago == m).ToList();
                    var usd = delMetodo.Sum(p => p.TotalUsd);
                    var enMoneda = moneda == MonedaPago.Ves ? delMetodo.Sum(p => p.TotalBs) : usd;
                    return new VentaMetodoPago(m, moneda, delMetodo.Count, usd, enMoneda, Porcentaje(usd, totalUsd));
                })
                .ToList();
            return new VentasPorMetodoPago(metodos,
                ventas.Where(p => p.MonedaPago == MonedaPago.Ves).Sum(p => p.TotalBs),
                ventas.Where(p => p.MonedaPago == MonedaPago.Usdt).Sum(p => p.TotalUsd));
        }

        private HorasPico HorasPico(List<PedidoReporte> ventas)
        {
            var matriz = Enumerable.Range(0, 7).Select(_ => new int[24]).ToArray();
            foreach (var p in ventas)
            {
                var local = Local(p.CreadoEn);
                matriz[((int)local.DayOfWeek + 6) % 7][local.Hour]++;
            }
            return new HorasPico(matriz, NombresDias);
        }

        private static List<VentaZona> Zonas(List<PedidoReporte> ventas, decimal totalUsd) =>
            ventas.GroupBy(p => p.ZonaId)
                .Select(g =>
                {
                    var usd = g.Sum(p => p.TotalUsd);
                    return new VentaZona(g.Key, g.First().Zona, g.Count(), usd, Porcentaje(usd, totalUsd));
                })
                .OrderByDescending(z => z.IngresosUsd).ThenBy(z => z.Zona)
                .ToList();

        private static OperacionPedidos Operacion(List<PedidoReporte> pedidos)
        {
            var aprobados = pedidos.Where(EsVenta).ToList();
            var rechazados = pedidos.Count(p => p.Estado == EstadoPedido.Rechazado);
            var expirados = pedidos.Count(p => p.Estado == EstadoPedido.Expirado);
            var resueltos = aprobados.Count + rechazados + expirados;

            return new OperacionPedidos(
                pedidos.Count,
                aprobados.Count,
                rechazados,
                expirados,
                pedidos.Count(p => p.Estado == EstadoPedido.Pendiente),
                resueltos == 0 ? null : Porcentaje(aprobados.Count, resueltos),
                resueltos == 0 ? null : Porcentaje(rechazados, resueltos),
                resueltos == 0 ? null : Porcentaje(expirados, resueltos),
                PromedioMinutos(aprobados.Where(p => p.RevisadoEn is not null).Select(p => p.RevisadoEn!.Value - p.CreadoEn)),
                PromedioMinutos(Entregados(pedidos).Select(p => p.EntregadoEn!.Value - p.AsignadoEn!.Value)));
        }

        private static InventarioKpis Inventario(List<ProductoStock> productos, List<ItemReporte> items,
            Dictionary<Guid, int> stockInicio, Dictionary<Guid, int> stockFin)
        {
            var vendidas = items.GroupBy(i => i.ProductoId).ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));
            var filas = productos
                .Select(p =>
                {
                    var inicio = stockInicio.TryGetValue(p.Id, out var si) ? si : p.StockDisponible;
                    var fin = stockFin.TryGetValue(p.Id, out var sf) ? sf : p.StockDisponible;
                    var promedio = (inicio + fin) / 2m;
                    var unidades = vendidas.GetValueOrDefault(p.Id);
                    return new InventarioProducto(p.Id, p.Nombre, p.Categoria, p.StockDisponible, p.StockReservado, unidades,
                        promedio, promedio == 0 ? null : Math.Round(unidades / promedio, 2), p.StockDisponible == 0);
                })
                .OrderByDescending(p => p.Agotado).ThenByDescending(p => p.Rotacion ?? 0).ThenBy(p => p.Producto)
                .ToList();

            var stockPromedioTotal = filas.Sum(f => f.StockPromedio);
            return new InventarioKpis(filas, filas.Where(f => f.Agotado).ToList(),
                stockPromedioTotal == 0 ? null : Math.Round(filas.Sum(f => f.UnidadesVendidas) / stockPromedioTotal, 2));
        }

        private static List<EntregasRepartidor> Repartidores(List<PedidoReporte> pedidos) =>
            Entregados(pedidos)
                .Where(p => p.RepartidorId is not null)
                .GroupBy(p => p.RepartidorId!.Value)
                .Select(g => new EntregasRepartidor(g.Key, g.First().Repartidor ?? "", g.Count(),
                    PromedioMinutos(g.Select(p => p.EntregadoEn!.Value - p.AsignadoEn!.Value))))
                .OrderByDescending(r => r.Entregas).ThenBy(r => r.Repartidor)
                .ToList();

        private static IEnumerable<PedidoReporte> Entregados(List<PedidoReporte> pedidos) =>
            pedidos.Where(p => p.Estado == EstadoPedido.Entregado && p.EntregadoEn is not null && p.AsignadoEn is not null);

        // ---- Utilidades ----

        private Periodo Crear(TipoReporte tipo, DateOnly desde, DateOnly hasta) =>
            new(tipo, desde, hasta, InicioDelDiaUtc(desde), InicioDelDiaUtc(hasta.AddDays(1)));

        private DateTime InicioDelDiaUtc(DateOnly fecha) =>
            TimeZoneInfo.ConvertTimeToUtc(fecha.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zona);

        private DateTime Local(DateTime utc) =>
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zona);

        private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;

        private static decimal Dividir(decimal a, int b) => b == 0 ? 0 : Math.Round(a / b, 2, MidpointRounding.AwayFromZero);

        private static decimal Porcentaje(decimal parte, decimal total) =>
            total == 0 ? 0 : Math.Round(parte / total * 100, 2, MidpointRounding.AwayFromZero);

        private static decimal? Crecimiento(decimal actual, decimal anterior) =>
            anterior == 0 ? null : Math.Round((actual - anterior) / anterior * 100, 2, MidpointRounding.AwayFromZero);

        private static double? PromedioMinutos(IEnumerable<TimeSpan> duraciones)
        {
            var lista = duraciones.ToList();
            return lista.Count == 0 ? null : Math.Round(lista.Average(d => d.TotalMinutes), 1);
        }
    }
}
