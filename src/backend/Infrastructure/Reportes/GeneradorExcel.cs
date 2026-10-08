using Core.Application.Abstracciones;
using Core.Application.Modelos;
using Core.Domain.Enums;
using ClosedXML.Excel;

namespace Infrastructure.Reportes
{
    // Informe de ventas con ClosedXML. En cada hoja: encabezados en negrita y congelados, filtros
    // automáticos, montos con formato de moneda y fechas con formato de fecha (se guardan como
    // números y fechas, no como texto, para que Excel pueda sumarlos y filtrarlos).
    public class GeneradorExcel : IGeneradorExcel
    {
        private enum Formato { Texto, Entero, Decimal, Usd, Bs, Porcentaje, Fecha, FechaHora, Hora, Minutos }

        private sealed record Columna(string Titulo, Formato Formato);

        public byte[] Generar(DatosReporte datos)
        {
            var k = datos.Kpis;
            using var libro = new XLWorkbook();

            HojaResumen(libro, k);

            Hoja(libro, "Ventas por día",
                [new("Fecha", Formato.Fecha), new("Pedidos", Formato.Entero), new("Unidades", Formato.Entero),
                 new("Ventas USD", Formato.Usd), new("Ventas Bs", Formato.Bs), new("Ticket promedio USD", Formato.Usd)],
                k.VentasPorDia.Select(d => new object?[] { d.Inicio, d.Pedidos, d.Unidades, d.VentasUsd, d.VentasBs, d.TicketPromedioUsd }));

            Hoja(libro, "Productos",
                [new("Posición", Formato.Entero), new("Producto", Formato.Texto), new("Categoría", Formato.Texto),
                 new("Unidades vendidas", Formato.Entero), new("Ingresos USD", Formato.Usd)],
                k.Productos.Select(p => new object?[] { p.Posicion, p.Producto, p.Categoria, p.Unidades, p.IngresosUsd }));

            Hoja(libro, "Categorías",
                [new("Categoría", Formato.Texto), new("Unidades", Formato.Entero), new("Ingresos USD", Formato.Usd),
                 new("% del total", Formato.Porcentaje)],
                k.Categorias.Select(c => new object?[] { c.Categoria, c.Unidades, c.IngresosUsd, c.Porcentaje }));

            Hoja(libro, "Métodos de pago",
                [new("Método", Formato.Texto), new("Moneda", Formato.Texto), new("Pedidos", Formato.Entero),
                 new("Monto USD", Formato.Usd), new("Monto en Bs o USDT", Formato.Decimal), new("% del total", Formato.Porcentaje)],
                k.MetodosPago.Metodos.Select(m => new object?[]
                {
                    Nombre(m.Metodo), m.Moneda == MonedaPago.Ves ? "Bs" : "USDT", m.Pedidos, m.MontoUsd, m.MontoMoneda, m.Porcentaje,
                }));

            Hoja(libro, "Horas pico",
                [new("Día", Formato.Texto), .. Enumerable.Range(0, 24).Select(h => new Columna($"{h:00}:00", Formato.Entero)),
                 new("Total", Formato.Entero)],
                k.HorasPico.Pedidos.Select((horas, dia) =>
                    new object?[] { k.HorasPico.Dias[dia] }.Concat(horas.Cast<object?>()).Append(horas.Sum()).ToArray()));

            Hoja(libro, "Zonas",
                [new("Zona", Formato.Texto), new("Pedidos", Formato.Entero), new("Ingresos USD", Formato.Usd),
                 new("% del total", Formato.Porcentaje)],
                k.Zonas.Select(z => new object?[] { z.Zona, z.Pedidos, z.IngresosUsd, z.Porcentaje }));

            Hoja(libro, "Inventario",
                [new("Producto", Formato.Texto), new("Categoría", Formato.Texto), new("Stock disponible", Formato.Entero),
                 new("Stock reservado", Formato.Entero), new("Unidades vendidas", Formato.Entero),
                 new("Stock promedio", Formato.Decimal), new("Rotación", Formato.Decimal), new("Agotado", Formato.Texto)],
                k.Inventario.Productos.Select(p => new object?[]
                {
                    p.Producto, p.Categoria, p.StockDisponible, p.StockReservado, p.UnidadesVendidas, p.StockPromedio, p.Rotacion,
                    p.Agotado ? "Sí" : "No",
                }));

            Hoja(libro, "Repartidores",
                [new("Repartidor", Formato.Texto), new("Entregas", Formato.Entero), new("Tiempo promedio de entrega (min)", Formato.Minutos)],
                k.Repartidores.Select(r => new object?[] { r.Repartidor, r.Entregas, r.TiempoPromedioEntregaMin }));

            Hoja(libro, "Detalle de pedidos",
                [new("N.º pedido", Formato.Entero), new("Fecha", Formato.Fecha), new("Hora", Formato.Hora), new("Estado", Formato.Texto),
                 new("Cliente", Formato.Texto), new("Zona", Formato.Texto), new("Método de pago", Formato.Texto),
                 new("Producto", Formato.Texto), new("Categoría", Formato.Texto), new("Cantidad", Formato.Entero),
                 new("Precio USD", Formato.Usd), new("Precio Bs", Formato.Bs), new("Tasa", Formato.Decimal)],
                datos.Detalle.Select(d => new object?[]
                {
                    d.NumeroPedido, DateOnly.FromDateTime(d.FechaHoraLocal), d.FechaHoraLocal.TimeOfDay, Nombre(d.Estado), d.Cliente,
                    d.Zona, Nombre(d.MetodoPago), d.Producto, d.Categoria, d.Cantidad, d.PrecioUsd, d.PrecioBs, d.Tasa,
                }));

            using var salida = new MemoryStream();
            libro.SaveAs(salida);
            return salida.ToArray();
        }

        // Período y fecha de generación arriba; debajo, una fila por KPI con el período anterior
        // y la variación cuando aplica.
        private static void HojaResumen(XLWorkbook libro, Kpis k)
        {
            var hoja = libro.Worksheets.Add("Resumen");
            hoja.Cell(1, 1).Value = "Informe de ventas";
            hoja.Cell(1, 1).Style.Font.Bold = true;
            hoja.Cell(1, 1).Style.Font.FontSize = 14;
            Escribir(hoja.Cell(2, 1), "Período", Formato.Texto);
            Escribir(hoja.Cell(2, 2), $"{k.Periodo.Desde:dd/MM/yyyy} – {k.Periodo.Hasta:dd/MM/yyyy} ({Nombre(k.Periodo.Tipo)})", Formato.Texto);
            Escribir(hoja.Cell(3, 1), "Período anterior", Formato.Texto);
            Escribir(hoja.Cell(3, 2), $"{k.Periodo.AnteriorDesde:dd/MM/yyyy} – {k.Periodo.AnteriorHasta:dd/MM/yyyy}" +
                (k.Periodo.EnCurso ? $" (período en curso: se comparan los {k.Periodo.DiasComparados} días transcurridos)" : ""),
                Formato.Texto);
            Escribir(hoja.Cell(4, 1), "Generado", Formato.Texto);
            Escribir(hoja.Cell(4, 2), k.Periodo.GeneradoEnLocal, Formato.FechaHora);
            Escribir(hoja.Cell(4, 3), $"hora local ({k.Periodo.ZonaHoraria})", Formato.Texto);

            var r = k.Resumen;
            var o = k.Operacion;
            // (KPI, actual, anterior, variación %, formato)
            var filas = new List<(string, object?, object?, decimal?, Formato)>
            {
                ("Ventas totales USD", r.Actual.VentasUsd, r.Anterior.VentasUsd, r.CrecimientoVentasPct, Formato.Usd),
                ("Ventas totales Bs", r.Actual.VentasBs, r.Anterior.VentasBs, null, Formato.Bs),
                ("Pedidos vendidos", r.Actual.Pedidos, r.Anterior.Pedidos, r.CrecimientoPedidosPct, Formato.Entero),
                ("Unidades vendidas", r.Actual.Unidades, r.Anterior.Unidades, null, Formato.Entero),
                ("Ticket promedio USD", r.Actual.TicketPromedioUsd, r.Anterior.TicketPromedioUsd, r.CrecimientoTicketPct, Formato.Usd),
                ("Unidades por pedido", r.Actual.UnidadesPorPedido, r.Anterior.UnidadesPorPedido, null, Formato.Decimal),
                ("% aprobados", o.PorcentajeAprobados, null, null, Formato.Porcentaje),
                ("% rechazados", o.PorcentajeRechazados, null, null, Formato.Porcentaje),
                ("% expirados", o.PorcentajeExpirados, null, null, Formato.Porcentaje),
                ("Pedidos pendientes", o.Pendientes, null, null, Formato.Entero),
                ("Tiempo promedio de aprobación (min)", o.TiempoPromedioAprobacionMin, null, null, Formato.Minutos),
                ("Tiempo promedio de entrega (min)", o.TiempoPromedioEntregaMin, null, null, Formato.Minutos),
                ("Rotación del stock", k.Inventario.RotacionGlobal, null, null, Formato.Decimal),
                ("Productos sin stock", k.Inventario.SinStock.Count, null, null, Formato.Entero),
            };

            Tabla(hoja, 6,
                [new("KPI", Formato.Texto), new("Período", Formato.Texto), new("Período anterior", Formato.Texto),
                 new("Variación %", Formato.Porcentaje)],
                filas.Select(f => new object?[] { f.Item1, f.Item2, f.Item3, f.Item4 }),
                // Las columnas de valores cambian de formato por fila.
                (fila, columna) => columna is 1 or 2 ? filas[fila].Item5 : null);
        }

        private static void Hoja(XLWorkbook libro, string nombre, Columna[] columnas, IEnumerable<object?[]> filas) =>
            Tabla(libro.Worksheets.Add(nombre), 1, columnas, filas);

        // Encabezado en `filaEncabezado`, congelado y con autofiltro sobre toda la tabla.
        private static void Tabla(IXLWorksheet hoja, int filaEncabezado, Columna[] columnas, IEnumerable<object?[]> filas,
            Func<int, int, Formato?>? formatoCelda = null)
        {
            for (var c = 0; c < columnas.Length; c++)
            {
                hoja.Cell(filaEncabezado, c + 1).Value = columnas[c].Titulo;
            }
            var encabezado = hoja.Range(filaEncabezado, 1, filaEncabezado, columnas.Length);
            encabezado.Style.Font.Bold = true;
            encabezado.Style.Fill.BackgroundColor = XLColor.FromHtml("#DCE6F1");

            var fila = filaEncabezado;
            var indice = 0;
            foreach (var valores in filas)
            {
                fila++;
                for (var c = 0; c < columnas.Length; c++)
                {
                    Escribir(hoja.Cell(fila, c + 1), valores[c], formatoCelda?.Invoke(indice, c) ?? columnas[c].Formato);
                }
                indice++;
            }

            hoja.SheetView.FreezeRows(filaEncabezado);
            hoja.Range(filaEncabezado, 1, fila, columnas.Length).SetAutoFilter();
            hoja.Columns(1, columnas.Length).AdjustToContents(filaEncabezado, fila);
        }

        private static void Escribir(IXLCell celda, object? valor, Formato formato)
        {
            celda.Value = valor switch
            {
                null => Blank.Value,
                string s => s,
                int i => i,
                double d => d,
                // Los porcentajes vienen como 12.5 (= 12,5 %); Excel los guarda como 0,125.
                decimal m when formato == Formato.Porcentaje => (double)(m / 100),
                decimal m => m,
                DateOnly f => f.ToDateTime(TimeOnly.MinValue),
                DateTime f => f,
                TimeSpan t => t,
                _ => valor.ToString(),
            };

            celda.Style.NumberFormat.Format = formato switch
            {
                Formato.Entero => "#,##0",
                Formato.Decimal => "#,##0.00",
                Formato.Usd => "\"$\"#,##0.00",
                Formato.Bs => "\"Bs\" #,##0.00",
                Formato.Porcentaje => "0.00%",
                Formato.Fecha => "dd/mm/yyyy",
                Formato.FechaHora => "dd/mm/yyyy hh:mm",
                Formato.Hora => "hh:mm",
                Formato.Minutos => "#,##0.0",
                _ => "@",
            };
        }

        private static string Nombre(MetodoPago m) => m switch
        {
            MetodoPago.Transferencia => "Transferencia",
            MetodoPago.PagoMovil => "Pago móvil",
            MetodoPago.Binance => "Binance",
            _ => m.ToString(),
        };

        private static string Nombre(EstadoPedido e) => e switch
        {
            EstadoPedido.Aprobado => "Aprobado",
            EstadoPedido.Asignado => "Asignado",
            EstadoPedido.EnCamino => "En camino",
            EstadoPedido.Entregado => "Entregado",
            _ => e.ToString(),
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
