using System.Globalization;
using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Domain.Enums;
using Core.Domain.Reglas;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Infrastructure.Reportes
{
    // Informe del dashboard KPI en PDF con QuestPDF (licencia Community: gratis para proyectos con
    // menos de 1 M USD de ingresos). Sigue el orden de la pantalla: ventas, productos y categorías,
    // horas pico y zonas, inventario, operación y comportamiento de los visitantes. Los números
    // salen del mismo cálculo que /kpis y /analitica/comportamiento, así que coinciden con lo que
    // se ve. Las listas largas se recortan; el detalle completo está en el Excel.
    public class GeneradorPdf : IGeneradorPdf
    {
        // Formato venezolano (1.234,56) construido a mano: la imagen Docker Alpine corre en modo de
        // globalización invariante (sin ICU), donde GetCultureInfo("es-VE") lanza una excepción.
        private static readonly CultureInfo Cultura = CrearCulturaVenezolana();
        private const string Marca = "#1D4ED8";
        private const string Suave = "#DBEAFE";
        private const string Borde = "#E2E8F0";
        private const string Gris = "#64748B";
        private const int MaxFilas = 15;

        static GeneradorPdf() => QuestPDF.Settings.License = LicenseType.Community;

        public byte[] Generar(Kpis kpis, Comportamiento comportamiento) =>
            Document.Create(documento => documento.Page(pagina =>
            {
                pagina.Size(PageSizes.A4);
                pagina.Margin(1.5f, Unit.Centimetre);
                pagina.DefaultTextStyle(t => t.FontSize(9).FontColor(Colors.Grey.Darken4));

                pagina.Header().Element(c => Encabezado(c, kpis.Periodo));
                pagina.Content().PaddingVertical(10).Column(col =>
                {
                    col.Spacing(14);
                    Ventas(col, kpis);
                    ProductosYCategorias(col, kpis);
                    HorasYZonas(col, kpis);
                    Inventario(col, kpis);
                    Operacion(col, kpis);
                    Visitantes(col, comportamiento);
                });
                pagina.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor(Gris));
                    t.Span("Página ");
                    t.CurrentPageNumber();
                    t.Span(" de ");
                    t.TotalPages();
                });
            })).GeneratePdf();

        private static void Encabezado(IContainer c, PeriodoKpis p) => c.BorderBottom(2).BorderColor(Marca).PaddingBottom(6).Row(fila =>
        {
            fila.RelativeItem().Column(col =>
            {
                col.Item().Text("Dashboard KPI · Supermercado").FontSize(16).Bold().FontColor(Marca);
                col.Item().Text($"Período {Nombre(p.Tipo)}: {p.Desde:dd/MM/yyyy} – {p.Hasta:dd/MM/yyyy}" + (p.EnCurso ? " (en curso)" : ""));
                col.Item().Text($"Comparado con {p.AnteriorDesde:dd/MM/yyyy} – {p.AnteriorHasta:dd/MM/yyyy}").FontColor(Gris);
            });
            fila.ConstantItem(150).AlignRight().AlignBottom()
                .Text($"Generado {p.GeneradoEnLocal:dd/MM/yyyy HH:mm}\n{p.ZonaHoraria}").FontSize(8).FontColor(Gris).AlignRight();
        });

        // ---- Secciones ----

        private static void Ventas(ColumnDescriptor col, Kpis k)
        {
            var r = k.Resumen;
            Titulo(col, "Ventas");
            Tarjetas(col,
                ("Ventas", Usd(r.Actual.VentasUsd), Crecimiento(r.CrecimientoVentasPct) + " · " + Bs(r.Actual.VentasBs)),
                ("Pedidos vendidos", Num(r.Actual.Pedidos), Crecimiento(r.CrecimientoPedidosPct) + $" · {Num(r.Actual.Unidades)} unidades"),
                ("Ticket promedio", Usd(r.Actual.TicketPromedioUsd), Crecimiento(r.CrecimientoTicketPct)),
                ("Unidades por pedido", Num(r.Actual.UnidadesPorPedido), $"antes: {Num(r.Anterior.UnidadesPorPedido)}"));

            var hoy = DateOnly.FromDateTime(k.Periodo.GeneradoEnLocal);
            var dias = k.VentasPorDia.Where(d => !k.Periodo.EnCurso || d.Inicio <= hoy).ToList();
            Subtitulo(col, "Ventas por día");
            Tabla(col, ["Día", "Pedidos", "Unidades", "USD", "Bs", "Ticket prom."], [2, 1, 1, 1.4f, 1.6f, 1.2f],
                dias.Select(d => new[] { $"{d.Inicio:dd/MM}", Num(d.Pedidos), Num(d.Unidades), Usd(d.VentasUsd), Bs(d.VentasBs), Usd(d.TicketPromedioUsd) }),
                "No hubo ventas en el período.", barra: (3, dias.Select(d => d.VentasUsd).ToList()), recortar: false);
        }

        private static void ProductosYCategorias(ColumnDescriptor col, Kpis k)
        {
            Titulo(col, "Productos y categorías");
            Subtitulo(col, "Top 10 más vendidos");
            var top = k.MasVendidos.Take(10).ToList();
            Tabla(col, ["#", "Producto", "Unidades", "Ingresos"], [0.5f, 4, 1, 1.3f],
                top.Select(p => new[] { Num(p.Posicion), p.Producto, Num(p.Unidades), Usd(p.IngresosUsd) }),
                "Sin ventas en el período.", barra: (2, top.Select(p => (decimal)p.Unidades).ToList()), textos: 2);

            Subtitulo(col, "Los 10 menos vendidos");
            Tabla(col, ["#", "Producto", "Unidades", "Ingresos"], [0.5f, 4, 1, 1.3f],
                k.MenosVendidos.Take(10).Select(p => new[] { Num(p.Posicion), p.Producto, Num(p.Unidades), Usd(p.IngresosUsd) }),
                "Sin datos.", textos: 2);

            Subtitulo(col, "Ventas por categoría");
            Tabla(col, ["Categoría", "Unidades", "Ingresos", "% del total"], [3, 1, 1.3f, 1],
                k.Categorias.Select(c => new[] { c.Categoria, Num(c.Unidades), Usd(c.IngresosUsd), Pct(c.Porcentaje) }),
                "Sin ventas en el período.", barra: (2, k.Categorias.Select(c => c.IngresosUsd).ToList()));

            Subtitulo(col, "Métodos de pago");
            Tabla(col, ["Método", "Pedidos", "USD", "En su moneda", "%"], [2, 1, 1.3f, 1.6f, 1],
                k.MetodosPago.Metodos.Select(m => new[]
                {
                    Nombre(m.Metodo), Num(m.Pedidos), Usd(m.MontoUsd),
                    m.Moneda == MonedaPago.Usdt ? $"{Num(m.MontoMoneda)} USDT" : Bs(m.MontoMoneda), Pct(m.Porcentaje),
                }),
                "Sin pagos en el período.");
            col.Item().Text($"Entra en Bs: {Bs(k.MetodosPago.EntraBs)} · Entra en USDT: {Num(k.MetodosPago.EntraUsdt)} USDT").FontColor(Gris);
        }

        private static void HorasYZonas(ColumnDescriptor col, Kpis k)
        {
            col.Item().ShowEntire().Column(bloque =>
            {
                bloque.Spacing(6);
                Titulo(bloque, "Horas pico y zonas");
                Subtitulo(bloque, "Pedidos por día de la semana y hora");
                MapaCalor(bloque, k.HorasPico);
            });

            Subtitulo(col, "Ventas por zona");
            Tabla(col, ["Zona", "Pedidos", "Ingresos", "%"], [3, 1, 1.3f, 1],
                k.Zonas.Select(z => new[] { z.Zona, Num(z.Pedidos), Usd(z.IngresosUsd), Pct(z.Porcentaje) }),
                "Sin ventas en el período.", barra: (2, k.Zonas.Select(z => z.IngresosUsd).ToList()));
        }

        private static void Inventario(ColumnDescriptor col, Kpis k)
        {
            Titulo(col, "Inventario");
            Tarjetas(col,
                ("Rotación del stock", Num(k.Inventario.RotacionGlobal), "vendidas ÷ stock promedio"),
                ("Productos sin stock", Num(k.Inventario.SinStock.Count), k.Inventario.SinStock.Count > 0
                    ? string.Join(", ", k.Inventario.SinStock.Take(3).Select(p => p.Producto)) + (k.Inventario.SinStock.Count > 3 ? "…" : "")
                    : "todo con stock"),
                ("Ocupación del almacén", Pct(k.Inventario.OcupacionGlobal), NombreNivel(k.Inventario.NivelOcupacionGlobal)
                    + (k.Inventario.ProductosSaturados > 0 ? $" · {k.Inventario.ProductosSaturados} saturados" : "")));

            Subtitulo(col, "Ocupación por categoría");
            Tabla(col, ["Categoría", "Productos", "Unidades", "Capacidad", "Ocupación", "Nivel"], [3, 1, 1, 1, 1, 1],
                k.Inventario.OcupacionPorCategoria.Select(c => new[]
                {
                    c.Categoria, Num(c.Productos), Num(c.Unidades), Num(c.Capacidad), Pct(c.Ocupacion), NombreNivel(c.NivelOcupacion),
                }),
                "Sin productos.", barra: (4, k.Inventario.OcupacionPorCategoria.Select(c => c.Ocupacion ?? 0).ToList()));

            Subtitulo(col, "Rotación por producto");
            Tabla(col, ["Producto", "Categoría", "Vendidas", "Stock prom.", "Rotación", "Disponible"], [3, 2, 1, 1, 1, 1],
                k.Inventario.Productos.OrderByDescending(p => p.Rotacion ?? -1).Select(p => new[]
                {
                    p.Producto + (p.Agotado ? " (agotado)" : ""), p.Categoria, Num(p.UnidadesVendidas), Num(p.StockPromedio),
                    Num(p.Rotacion), Num(p.StockDisponible),
                }),
                "Sin productos.", textos: 2);
        }

        private static void Operacion(ColumnDescriptor col, Kpis k)
        {
            var o = k.Operacion;
            Titulo(col, "Operación");
            Tarjetas(col,
                ("Aprobados", Pct(o.PorcentajeAprobados), $"{o.Aprobados} de {o.Total - o.Pendientes} revisados"),
                ("Rechazados", Pct(o.PorcentajeRechazados), $"{o.Rechazados} pedidos"),
                ("Expirados", Pct(o.PorcentajeExpirados), $"{o.Expirados} · {o.Pendientes} pendientes"));
            Tarjetas(col,
                ("Tiempo de aprobación", Minutos(o.TiempoPromedioAprobacionMin), "promedio"),
                ("Tiempo de entrega", Minutos(o.TiempoPromedioEntregaMin), "de asignado a entregado"));

            Subtitulo(col, "Entregas por repartidor");
            Tabla(col, ["Repartidor", "Entregas", "Tiempo promedio"], [3, 1, 1.5f],
                k.Repartidores.Select(x => new[] { x.Repartidor, Num(x.Entregas), Minutos(x.TiempoPromedioEntregaMin) }),
                "No hubo entregas en el período.", barra: (1, k.Repartidores.Select(x => (decimal)x.Entregas).ToList()));
        }

        private static void Visitantes(ColumnDescriptor col, Comportamiento c)
        {
            Titulo(col, "Comportamiento de los visitantes");
            Tarjetas(col,
                ("Visitas", Num(c.Visitas), "sesiones distintas"),
                ("Búsquedas", Num(c.Busquedas), ""),
                ("Sin resultados", Pct(c.PorcentajeSinResultados), $"{Num(c.BusquedasSinResultados)} búsquedas"),
                ("Conversión", Pct(c.TasaConversion), "visitas que terminan en pedido"));

            Subtitulo(col, "Embudo de compra");
            Tabla(col, ["Paso", "Sesiones", "% de las visitas"], [3, 1, 1],
                c.Embudo.Select(p => new[] { p.Paso, Num(p.Sesiones), Pct(p.Porcentaje) }),
                "Sin visitas en el período.", barra: (1, c.Embudo.Select(p => (decimal)p.Sesiones).ToList()));

            Subtitulo(col, "Lo más buscado");
            Tabla(col, ["Búsqueda", "Veces", "Resultados"], [3, 1, 1],
                c.MasBuscado.Select(b => new[] { b.Texto, Num(b.Veces), Num(b.Resultados) }), "Sin búsquedas en el período.");

            Subtitulo(col, "Buscado sin resultados");
            Tabla(col, ["Búsqueda", "Veces", "Visitantes"], [3, 1, 1],
                c.SinResultados.Select(b => new[] { b.Texto, Num(b.Veces), Num(b.Sesiones) }), "Todas las búsquedas encontraron algo.");

            Subtitulo(col, "Agregados al carrito vs. vendidos");
            Tabla(col, ["Producto", "Agregadas", "Vendidas", "Visitantes"], [3, 1, 1, 1],
                c.Productos.Select(p => new[] { p.Producto, Num(p.UnidadesAgregadas), Num(p.UnidadesVendidas), Num(p.Sesiones) }),
                "Nadie agregó productos al carrito en el período.");

            Subtitulo(col, "Categorías más visitadas");
            Tabla(col, ["Categoría", "Clics", "Visitantes"], [3, 1, 1],
                c.Categorias.Select(x => new[] { x.Categoria, Num(x.Clics), Num(x.Sesiones) }), "Nadie filtró por categoría en el período.");

            Subtitulo(col, "Cupones que escriben los clientes");
            Tabla(col, ["Código", "Aplicados", "Rechazados"], [3, 1, 1],
                c.Cupones.Select(x => new[] { x.Codigo, Num(x.Aplicados), Num(x.Rechazados) }), "Nadie intentó usar cupones en el período.");

            col.Item().Text("Datos anónimos (sin IP ni datos personales). No se cuenta al personal ni a quien activó «No rastrear».")
                .FontSize(8).FontColor(Gris);
        }

        // ---- Piezas ----

        private static void Titulo(ColumnDescriptor col, string texto) =>
            col.Item().PaddingTop(4).BorderBottom(1).BorderColor(Borde).PaddingBottom(2)
                .Text(texto.ToUpper(Cultura)).FontSize(11).Bold().FontColor(Marca);

        private static void Subtitulo(ColumnDescriptor col, string texto) =>
            col.Item().Text(texto).SemiBold().FontSize(10);

        // ShowEntire: si la fila no cabe al final de la página pasa entera a la siguiente, en vez de
        // partir cada tarjeta (el valor en una página y su detalle en la otra).
        private static void Tarjetas(ColumnDescriptor col, params (string Titulo, string Valor, string Detalle)[] tarjetas) =>
            col.Item().ShowEntire().Row(fila =>
            {
                fila.Spacing(8);
                foreach (var t in tarjetas)
                {
                    fila.RelativeItem().Border(1).BorderColor(Borde).Background(Colors.Grey.Lighten5).Padding(8).Column(c =>
                    {
                        c.Item().Text(t.Titulo).FontSize(8).FontColor(Gris);
                        c.Item().Text(t.Valor).FontSize(14).Bold();
                        if (!string.IsNullOrEmpty(t.Detalle))
                        {
                            c.Item().Text(t.Detalle).FontSize(7.5f).FontColor(Gris);
                        }
                    });
                }
            });

        // Tabla con encabezado azul claro y filas alternadas. Las primeras `textos` columnas van a
        // la izquierda y el resto a la derecha (son cifras). `barra` dibuja una barra proporcional bajo el valor
        // de esa columna para leer la tabla de un vistazo.
        private static void Tabla(ColumnDescriptor col, string[] columnas, float[] anchos, IEnumerable<string[]> filas,
            string vacio, (int Columna, IReadOnlyList<decimal> Valores)? barra = null, bool recortar = true, int textos = 1)
        {
            var lista = filas.ToList();
            if (lista.Count == 0)
            {
                col.Item().Text(vacio).Italic().FontColor(Gris);
                return;
            }
            var visibles = recortar ? lista.Take(MaxFilas).ToList() : lista;
            var maximo = barra?.Valores.DefaultIfEmpty(0).Max() ?? 0;

            col.Item().Table(tabla =>
            {
                tabla.ColumnsDefinition(c =>
                {
                    foreach (var a in anchos)
                    {
                        c.RelativeColumn(a);
                    }
                });
                tabla.Header(h =>
                {
                    for (var i = 0; i < columnas.Length; i++)
                    {
                        var celda = h.Cell().Background(Suave).PaddingVertical(4).PaddingHorizontal(5);
                        (i < textos ? celda.AlignLeft() : celda.AlignRight()).Text(columnas[i]).SemiBold().FontSize(8.5f);
                    }
                });
                for (var f = 0; f < visibles.Count; f++)
                {
                    var fondo = f % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;
                    for (var i = 0; i < columnas.Length; i++)
                    {
                        var celda = tabla.Cell().Background(fondo).BorderBottom(0.5f).BorderColor(Borde).PaddingVertical(3).PaddingHorizontal(5);
                        if (barra is { } b && b.Columna == i && maximo > 0 && f < b.Valores.Count)
                        {
                            var valor = (float)Math.Max(0, b.Valores[f]);
                            var resto = (float)maximo - valor;
                            celda.Column(c =>
                            {
                                c.Item().AlignRight().Text(visibles[f][i]);
                                c.Item().PaddingTop(1).Height(3).Row(r =>
                                {
                                    if (resto > 0) r.RelativeItem(resto);
                                    if (valor > 0) r.RelativeItem(valor).Background(Marca);
                                });
                            });
                        }
                        else
                        {
                            (i < textos ? celda.AlignLeft() : celda.AlignRight()).Text(visibles[f][i]);
                        }
                    }
                }
            });
            if (lista.Count > visibles.Count)
            {
                col.Item().Text($"Se muestran {visibles.Count} de {lista.Count}. La lista completa está en el Excel.").FontSize(7.5f).FontColor(Gris);
            }
        }

        // Una celda por día y hora, más oscura cuantos más pedidos. Solo de 6:00 a 23:00, que es
        // cuando hay actividad; la madrugada se suma en la columna "0–5".
        private static void MapaCalor(ColumnDescriptor col, HorasPico h)
        {
            var maximo = Math.Max(1, h.Pedidos.SelectMany(d => d).DefaultIfEmpty(0).Max());
            col.Item().Table(tabla =>
            {
                tabla.ColumnsDefinition(c =>
                {
                    c.ConstantColumn(34);
                    for (var i = 0; i < 19; i++) c.RelativeColumn();
                });
                tabla.Cell().Text("");
                tabla.Cell().AlignCenter().Text("0–5").FontSize(6.5f).FontColor(Gris);
                for (var hora = 6; hora < 24; hora++)
                {
                    tabla.Cell().AlignCenter().Text($"{hora}").FontSize(6.5f).FontColor(Gris);
                }
                for (var dia = 0; dia < h.Pedidos.Length; dia++)
                {
                    tabla.Cell().AlignMiddle().Text(h.Dias[dia]).FontSize(7.5f);
                    var valores = new[] { h.Pedidos[dia].Take(6).Sum() }.Concat(h.Pedidos[dia].Skip(6));
                    foreach (var v in valores)
                    {
                        var intensidad = Math.Min(1.0, (double)v / maximo);
                        tabla.Cell().Padding(0.5f).Height(13).Background(Mezcla(intensidad)).AlignCenter().AlignMiddle()
                            .Text(v > 0 ? v.ToString(Cultura) : "").FontSize(6.5f).FontColor(intensidad > 0.55 ? Colors.White : Colors.Grey.Darken3);
                    }
                }
            });
        }

        // Interpola de gris muy claro (#F1F5F9) al azul de la marca (#1D4ED8).
        private static string Mezcla(double t)
        {
            static int L(int a, int b, double t) => (int)Math.Round(a + (b - a) * t);
            return $"#{L(0xF1, 0x1D, t):X2}{L(0xF5, 0x4E, t):X2}{L(0xF9, 0xD8, t):X2}";
        }

        // ---- Formatos (iguales a los de la pantalla) ----

        private static CultureInfo CrearCulturaVenezolana()
        {
            var cultura = (CultureInfo)CultureInfo.InvariantCulture.Clone();
            cultura.NumberFormat.NumberDecimalSeparator = ",";
            cultura.NumberFormat.NumberGroupSeparator = ".";
            return CultureInfo.ReadOnly(cultura);
        }

        private static string NombreNivel(NivelOcupacion? nivel) => nivel switch
        {
            NivelOcupacion.Baja => "baja",
            NivelOcupacion.Optima => "óptima",
            NivelOcupacion.Alta => "alta",
            NivelOcupacion.Saturada => "saturada",
            _ => "—",
        };

        private static string Usd(decimal v) => "$" + v.ToString("N2", Cultura);
        private static string Bs(decimal v) => "Bs " + v.ToString("N2", Cultura);
        private static string Num(decimal? v) => v is null ? "—" : v.Value.ToString("#,##0.##", Cultura);
        private static string Num(int v) => v.ToString("#,##0", Cultura);
        private static string Pct(decimal? v) => v is null ? "—" : v.Value.ToString("#,##0.##", Cultura) + " %";

        private static string Crecimiento(decimal? v) => v switch
        {
            null => "sin datos del período anterior",
            >= 0 => $"+{Pct(v)} vs. anterior",
            _ => $"-{Pct(-v)} vs. anterior",
        };

        private static string Minutos(double? min)
        {
            if (min is null) return "—";
            var h = (int)Math.Floor(min.Value / 60);
            var m = (int)Math.Round(min.Value % 60);
            return h > 0 ? $"{h} h {m} min" : $"{m} min";
        }

        private static string Nombre(MetodoPago m) => m switch
        {
            MetodoPago.Transferencia => "Transferencia",
            MetodoPago.PagoMovil => "Pago móvil",
            MetodoPago.Binance => "Binance",
            _ => m.ToString(),
        };

        private static string Nombre(TipoReporte t) => t switch
        {
            TipoReporte.Diario => "diario",
            TipoReporte.Semanal => "semanal",
            TipoReporte.Mensual => "mensual",
            _ => "personalizado",
        };
    }
}
