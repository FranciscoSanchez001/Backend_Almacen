import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { descargarExcel, obtenerKpis } from '../../api/reportes'
import { listarTodosLosProductos } from '../../api/productos'
import { listarInventario } from '../../api/inventario'
import { listarPedidos } from '../../api/pedidos'
import { listarNotificaciones } from '../../api/notificaciones'
import ContadorExpiracion from '../../components/ContadorExpiracion'
import { EstadoCarga, Selector } from '../../components/ui'
import { METODOS_PAGO, claseBoton, claseInput } from '../../utils/panel'
import { BarrasHorizontales, Dona, GraficoLinea, MapaCalor, TarjetaGrafico, TarjetaKpi } from '../../components/dashboard/Graficos'
import { formatoBs, formatoDia, formatoMinutos, formatoNumero, formatoPct, formatoUsd, hoyIso } from '../../utils/formato'
import { alertaStock } from '../../utils/stock'

// Dashboard KPI del gerente (superadmin). Todos los indicadores de la especificación
// salen de GET /kpis, con el filtro de período (hoy, semana, mes o rango). Se le suman:
// - Valorización del almacén (costo vs. precio de venta) calculada con /productos.
// - Alertas de stock crítico según los umbrales de cada producto, con /inventario.
// "Descargar Excel" baja el informe del mismo período: los números coinciden con la pantalla.
const PERIODOS = [
  ['diario', 'Hoy'],
  ['semanal', 'Esta semana'],
  ['mensual', 'Este mes'],
  ['personalizado', 'Personalizado'],
]

const usdCorto = (v) => `$${formatoNumero(v)}`

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}

// Valor del stock en el almacén (disponible + reservado) a costo y a precio de venta.
function calcularValorizacion(productos) {
  const porCategoria = new Map()
  let costo = 0
  let venta = 0
  for (const p of productos) {
    const unidades = p.stockDisponible + p.stockReservado
    const c = unidades * p.costoUsd
    const v = unidades * p.precioUsd
    costo += c
    venta += v
    const cat = porCategoria.get(p.categoria) ?? { categoria: p.categoria, costo: 0, venta: 0 }
    cat.costo += c
    cat.venta += v
    porCategoria.set(p.categoria, cat)
  }
  const categorias = [...porCategoria.values()]
    .map((c) => ({ ...c, costo: Math.round(c.costo * 100) / 100, venta: Math.round(c.venta * 100) / 100 }))
    .sort((a, b) => b.venta - a.venta)
  return { costo, venta, margen: venta - costo, margenPct: venta ? ((venta - costo) / venta) * 100 : 0, categorias }
}

// Franja compacta con lo que necesita atención hoy, arriba de los KPIs: el gerente
// ve primero los avisos y enseguida los indicadores. Cada aviso lleva a su pantalla.
function AvisosDelDia({ inventario }) {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let vigente = true
    Promise.all([listarPedidos({ estado: 'pendiente', tamano: 1 }), listarNotificaciones()])
      .then(([pendientes, avisos]) => vigente && setDatos({ pendientes, avisos }))
      .catch(() => {}) // Si falla, el dashboard sigue: la franja simplemente no aparece.
    return () => {
      vigente = false
    }
  }, [])

  if (!datos) return null
  // Mientras llega el inventario se muestra "…", no un 0 que no es real.
  const agotados = inventario ? inventario.filter((p) => p.stockDisponible === 0).length : '…'
  const bajos = inventario ? inventario.filter((p) => p.stockDisponible > 0 && p.stockDisponible < p.stockMinimo).length : '…'
  const urgente = datos.pendientes.items[0]
  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-superficie px-3 py-1 text-xs font-medium text-slate-700 hover:border-marca-200 dark:hover:border-marca-500'

  return (
    <nav aria-label="Avisos del día" className="flex flex-wrap items-center gap-2">
      <Link to="/panel/pedidos" className={chip}>
        <span aria-hidden>🧾</span>
        <strong className="text-slate-900">{datos.pendientes.total}</strong> por revisar
        {urgente && <ContadorExpiracion expiraEn={urgente.expiraEn} />}
      </Link>
      <Link to="/panel/inventario" className={chip}>
        <span aria-hidden>⛔</span>
        <strong className={agotados > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-900'}>{agotados}</strong> agotados
      </Link>
      <Link to="/panel/inventario" className={chip}>
        <span aria-hidden>⚠️</span>
        <strong className="text-slate-900">{bajos}</strong> bajo el mínimo
      </Link>
      <Link to="/panel#avisos" className={chip}>
        <span aria-hidden>🔔</span>
        <strong className="text-slate-900">{datos.avisos.total}</strong> avisos sin leer
      </Link>
    </nav>
  )
}

export default function PowerBIDashboard() {
  const [tipo, setTipo] = useState('mensual')
  const [desde, setDesde] = useState(hoyIso())
  const [hasta, setHasta] = useState(hoyIso())
  const [kpis, setKpis] = useState(null)
  const [almacen, setAlmacen] = useState(null) // { productos, inventario }
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [rankingPor, setRankingPor] = useState('unidades')
  const [descargando, setDescargando] = useState(false)
  const [errorExcel, setErrorExcel] = useState('')

  // Parámetros que entiende la API para el período elegido.
  const periodo = useMemo(
    () => (tipo === 'personalizado' ? { tipo, desde, hasta } : { tipo, desde: hoyIso() }),
    [tipo, desde, hasta],
  )
  const rangoInvalido = tipo === 'personalizado' && (!desde || !hasta || desde > hasta)

  const cargarKpis = useCallback(async () => {
    if (rangoInvalido) return
    setCargando(true)
    setError('')
    try {
      setKpis(await obtenerKpis(periodo))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [periodo, rangoInvalido])

  const cargarAlmacen = useCallback(async () => {
    try {
      const [productos, inventario] = await Promise.all([listarTodosLosProductos(), listarInventario()])
      setAlmacen({ productos, inventario })
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    cargarKpis()
  }, [cargarKpis])

  useEffect(() => {
    cargarAlmacen()
  }, [cargarAlmacen])

  async function alDescargar() {
    setDescargando(true)
    setErrorExcel('')
    try {
      await descargarExcel(periodo)
    } catch (e) {
      setErrorExcel(e.message)
    } finally {
      setDescargando(false)
    }
  }

  const valorizacion = useMemo(() => almacen && calcularValorizacion(almacen.productos), [almacen])
  const alertas = useMemo(
    () =>
      (almacen?.inventario ?? [])
        .map((p) => ({ ...p, alerta: alertaStock(p) }))
        .filter((p) => p.alerta.texto !== 'Normal')
        .sort((a, b) => a.stockDisponible - a.stockMinimo - (b.stockDisponible - b.stockMinimo)),
    [almacen],
  )

  const r = kpis?.resumen
  // Con el período en curso, los días que aún no llegan no son "ventas en cero": se omiten.
  const hoy = kpis?.periodo.generadoEnLocal.slice(0, 10)
  const dias = kpis ? kpis.ventasPorDia.filter((d) => !kpis.periodo.enCurso || d.inicio <= hoy) : []
  const ranking = kpis && (rankingPor === 'unidades' ? kpis.masVendidos : kpis.masVendidosPorIngresos).slice(0, 10)
  const rotacion = kpis && [...kpis.inventario.productos].sort((a, b) => b.rotacion - a.rotacion)
  const metodos = kpis?.metodosPago.metodos.map((m) => ({ ...m, nombre: METODOS_PAGO[m.metodo] ?? m.metodo })) ?? []
  const op = kpis?.operacion

  return (
    <div className="space-y-8">
      {/* Encabezado, avisos del día y filtros en una sola fila sobre todos los gráficos */}
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold">Dashboard KPI</h2>
          <p className="mt-1 text-slate-600">
            Ventas, inventario y operación.
            {kpis && (
              <span className="text-slate-500">
                {' '}
                Período: {formatoDia(kpis.periodo.desde)} – {formatoDia(kpis.periodo.hasta)}
                {kpis.periodo.enCurso && ' (en curso)'} · comparado con {formatoDia(kpis.periodo.anteriorDesde)} –{' '}
                {formatoDia(kpis.periodo.anteriorHasta)}
              </span>
            )}
          </p>
        </div>
        <AvisosDelDia inventario={almacen?.inventario} />
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-superficie p-3 lg:flex-row lg:items-center">
          <Selector etiqueta="Período" opciones={PERIODOS} valor={tipo} alCambiar={setTipo} />
          {tipo === 'personalizado' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                Desde
                <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={`${claseInput()} w-auto`} />
              </label>
              <label className="flex items-center gap-1">
                Hasta
                <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={`${claseInput()} w-auto`} />
              </label>
            </div>
          )}
          <div className="flex items-center gap-2 lg:ml-auto">
            {cargando && kpis && <span className="text-xs text-slate-500">Actualizando…</span>}
            <button type="button" onClick={alDescargar} disabled={descargando || rangoInvalido} className={claseBoton.primario}>
              {descargando ? 'Generando…' : '⬇ Descargar Excel'}
            </button>
          </div>
        </div>
        {rangoInvalido && <p className="text-sm text-red-700 dark:text-red-300">Elige un rango válido: “desde” no puede ser posterior a “hasta”.</p>}
        {errorExcel && <p className="text-sm text-red-700 dark:text-red-300">{errorExcel}</p>}
      </section>

      <EstadoCarga cargando={!kpis && !error} error={!kpis && error} alReintentar={cargarKpis}>
        {kpis && (
          <div className={`space-y-8 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
            {/* 1. Análisis de ventas */}
            <Seccion titulo="Ventas">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <TarjetaKpi titulo="Ventas" valor={formatoUsd(r.actual.ventasUsd)} crecimiento={r.crecimientoVentasPct} detalle={formatoBs(r.actual.ventasBs)} />
                <TarjetaKpi titulo="Pedidos vendidos" valor={formatoNumero(r.actual.pedidos)} crecimiento={r.crecimientoPedidosPct} detalle={`${formatoNumero(r.actual.unidades)} unidades`} />
                <TarjetaKpi titulo="Ticket promedio" valor={formatoUsd(r.actual.ticketPromedioUsd)} crecimiento={r.crecimientoTicketPct} detalle="por pedido" />
                <TarjetaKpi titulo="Unidades por pedido" valor={formatoNumero(r.actual.unidadesPorPedido)} detalle={`antes: ${formatoNumero(r.anterior.unidadesPorPedido)}`} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <TarjetaGrafico
                  titulo="Ventas por día (USD)"
                  detalle="Solo cuentan los pedidos aprobados, asignados, en camino o entregados."
                  tabla={{
                    columnas: ['Día', 'Pedidos', 'Unidades', 'USD', 'Bs'],
                    filas: dias.map((d) => [formatoDia(d.inicio), d.pedidos, d.unidades, formatoUsd(d.ventasUsd), formatoBs(d.ventasBs)]),
                  }}
                >
                  <GraficoLinea datos={dias} x="inicio" y="ventasUsd" nombre="Ventas" formato={usdCorto} formatoX={formatoDia} />
                </TarjetaGrafico>
                <TarjetaGrafico
                  titulo="Ticket promedio por día (USD)"
                  tabla={{
                    columnas: ['Día', 'Ticket promedio'],
                    filas: dias.map((d) => [formatoDia(d.inicio), formatoUsd(d.ticketPromedioUsd)]),
                  }}
                >
                  <GraficoLinea datos={dias} x="inicio" y="ticketPromedioUsd" nombre="Ticket" formato={usdCorto} formatoX={formatoDia} />
                </TarjetaGrafico>
              </div>
            </Seccion>

            {/* 2. Productos y categorías */}
            <Seccion titulo="Productos y categorías">
              <div className="grid gap-4 xl:grid-cols-2">
                <TarjetaGrafico
                  titulo="Top 10 más vendidos"
                  tabla={{
                    columnas: ['#', 'Producto', 'Unidades', 'Ingresos'],
                    filas: ranking.map((p) => [p.posicion, p.producto, p.unidades, formatoUsd(p.ingresosUsd)]),
                  }}
                >
                  <div className="mb-2">
                    <Selector
                      etiqueta="Ordenar ranking por"
                      opciones={[
                        ['unidades', 'Por unidades'],
                        ['ingresos', 'Por ingresos'],
                      ]}
                      valor={rankingPor}
                      alCambiar={setRankingPor}
                    />
                  </div>
                  <BarrasHorizontales
                    datos={ranking}
                    categoria="producto"
                    series={[rankingPor === 'unidades' ? { clave: 'unidades', nombre: 'Unidades' } : { clave: 'ingresosUsd', nombre: 'Ingresos' }]}
                    formato={rankingPor === 'unidades' ? formatoNumero : usdCorto}
                  />
                </TarjetaGrafico>
                <TarjetaGrafico
                  titulo="Los 10 menos vendidos"
                  detalle="Por unidades, de menor a mayor."
                  tabla={{
                    columnas: ['#', 'Producto', 'Unidades', 'Ingresos'],
                    filas: kpis.menosVendidos.slice(0, 10).map((p) => [p.posicion, p.producto, p.unidades, formatoUsd(p.ingresosUsd)]),
                  }}
                >
                  <BarrasHorizontales datos={kpis.menosVendidos.slice(0, 10)} categoria="producto" series={[{ clave: 'unidades', nombre: 'Unidades' }]} formato={formatoNumero} />
                </TarjetaGrafico>
                <TarjetaGrafico
                  titulo="Ventas por categoría (USD)"
                  tabla={{
                    columnas: ['Categoría', 'Unidades', 'Ingresos', '% del total'],
                    filas: kpis.categorias.map((c) => [c.categoria, c.unidades, formatoUsd(c.ingresosUsd), formatoPct(c.porcentaje)]),
                  }}
                >
                  <BarrasHorizontales datos={kpis.categorias} categoria="categoria" series={[{ clave: 'ingresosUsd', nombre: 'Ingresos' }]} formato={usdCorto} />
                </TarjetaGrafico>
                <TarjetaGrafico
                  titulo="Métodos de pago"
                  detalle="Monto en USD de cada método."
                  tabla={{
                    columnas: ['Método', 'Pedidos', 'USD', 'En su moneda', '%'],
                    filas: metodos.map((m) => [
                      m.nombre,
                      m.pedidos,
                      formatoUsd(m.montoUsd),
                      m.moneda === 'USDT' ? `${formatoNumero(m.montoMoneda)} USDT` : formatoBs(m.montoMoneda),
                      formatoPct(m.porcentaje),
                    ]),
                  }}
                >
                  <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Dona datos={metodos} clave="montoUsd" nombre="nombre" formato={formatoUsd} />
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-slate-500">Entra en Bs</dt>
                        <dd className="font-semibold">{formatoBs(kpis.metodosPago.entraBs)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Entra en USDT</dt>
                        <dd className="font-semibold">{formatoNumero(kpis.metodosPago.entraUsdt)} USDT</dd>
                      </div>
                    </dl>
                  </div>
                </TarjetaGrafico>
              </div>
            </Seccion>

            {/* 3. Cuándo y dónde se compra */}
            <Seccion titulo="Horas pico y zonas">
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <TarjetaGrafico titulo="Horas y días pico" detalle="Pedidos por día de la semana y hora. Pasa el mouse por una celda para ver la cantidad.">
                  <MapaCalor matriz={kpis.horasPico.pedidos} dias={kpis.horasPico.dias} />
                </TarjetaGrafico>
                <TarjetaGrafico
                  titulo="Ventas por zona (USD)"
                  tabla={{
                    columnas: ['Zona', 'Pedidos', 'Ingresos', '%'],
                    filas: kpis.zonas.map((z) => [z.zona, z.pedidos, formatoUsd(z.ingresosUsd), formatoPct(z.porcentaje)]),
                  }}
                >
                  <BarrasHorizontales datos={kpis.zonas} categoria="zona" series={[{ clave: 'ingresosUsd', nombre: 'Ingresos' }]} formato={usdCorto} />
                </TarjetaGrafico>
              </div>
            </Seccion>

            {/* 4. Inventario: valorización, rotación y alertas */}
            <Seccion titulo="Inventario">
              {valorizacion ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <TarjetaKpi titulo="Valor del almacén a costo" valor={formatoUsd(valorizacion.costo)} detalle="Disponible + reservado" />
                  <TarjetaKpi titulo="Valor a precio de venta" valor={formatoUsd(valorizacion.venta)} detalle="Si se vendiera todo" />
                  <TarjetaKpi titulo="Margen potencial" valor={formatoUsd(valorizacion.margen)} detalle={`${formatoPct(valorizacion.margenPct)} sobre la venta`} />
                  <TarjetaKpi titulo="Rotación del stock" valor={formatoNumero(kpis.inventario.rotacionGlobal)} detalle="Unidades vendidas ÷ stock promedio" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Calculando la valorización…</p>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {valorizacion && (
                  <TarjetaGrafico
                    titulo="Valorización por categoría: costo vs. venta (USD)"
                    tabla={{
                      columnas: ['Categoría', 'A costo', 'A precio de venta'],
                      filas: valorizacion.categorias.map((c) => [c.categoria, formatoUsd(c.costo), formatoUsd(c.venta)]),
                    }}
                  >
                    <BarrasHorizontales
                      datos={valorizacion.categorias}
                      categoria="categoria"
                      series={[
                        { clave: 'costo', nombre: 'A costo' },
                        { clave: 'venta', nombre: 'A precio de venta' },
                      ]}
                      formato={usdCorto}
                    />
                  </TarjetaGrafico>
                )}

                <TarjetaGrafico titulo="Alertas de stock crítico" detalle="Según el stock mínimo y máximo de cada producto. Los más urgentes primero.">
                  {alertas.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">Todo el inventario está dentro de sus umbrales.</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full min-w-[460px] text-left text-sm">
                        <thead className="sticky top-0 bg-superficie text-xs uppercase text-slate-500">
                          <tr>
                            <th className="py-2 font-semibold">Producto</th>
                            <th className="py-2 text-right font-semibold">Disp.</th>
                            <th className="py-2 text-right font-semibold">Mín. / Máx.</th>
                            <th className="py-2 pl-3 font-semibold">Alerta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {alertas.map((p) => (
                            <tr key={p.productoId}>
                              <td className="py-2">{p.nombre}</td>
                              <td className="py-2 text-right font-semibold">{p.stockDisponible}</td>
                              <td className="py-2 text-right text-slate-600">
                                {p.stockMinimo} / {p.stockMaximo}
                              </td>
                              <td className="py-2 pl-3">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${p.alerta.clase}`}>
                                  <span aria-hidden>{p.alerta.icono}</span> {p.alerta.texto}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TarjetaGrafico>

                <TarjetaGrafico titulo="Rotación por producto" detalle="Unidades vendidas en el período ÷ stock promedio." className="xl:col-span-2">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="sticky top-0 bg-superficie text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2 font-semibold">Producto</th>
                          <th className="py-2 font-semibold">Categoría</th>
                          <th className="py-2 text-right font-semibold">Vendidas</th>
                          <th className="py-2 text-right font-semibold">Stock prom.</th>
                          <th className="py-2 text-right font-semibold">Rotación</th>
                          <th className="py-2 text-right font-semibold">Disponible</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rotacion.map((p) => (
                          <tr key={p.productoId}>
                            <td className="py-2">
                              {p.producto} {p.agotado && <span className="text-xs font-semibold text-red-700 dark:text-red-300">⛔ agotado</span>}
                            </td>
                            <td className="py-2 text-slate-600">{p.categoria}</td>
                            <td className="py-2 text-right">{p.unidadesVendidas}</td>
                            <td className="py-2 text-right">{formatoNumero(p.stockPromedio)}</td>
                            <td className="py-2 text-right font-semibold">{formatoNumero(p.rotacion)}</td>
                            <td className="py-2 text-right">{p.stockDisponible}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TarjetaGrafico>
              </div>
            </Seccion>

            {/* 5. Operación */}
            <Seccion titulo="Operación">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <TarjetaKpi titulo="Aprobados" valor={formatoPct(op.porcentajeAprobados)} detalle={`${op.aprobados} de ${op.total - op.pendientes} revisados`} />
                <TarjetaKpi titulo="Rechazados" valor={formatoPct(op.porcentajeRechazados)} detalle={`${op.rechazados} pedidos`} />
                <TarjetaKpi titulo="Expirados" valor={formatoPct(op.porcentajeExpirados)} detalle={`${op.expirados} pedidos · ${op.pendientes} aún pendientes`} alerta={op.expirados > 0} />
                <TarjetaKpi titulo="Tiempo de aprobación" valor={formatoMinutos(op.tiempoPromedioAprobacionMin)} detalle="promedio" />
                <TarjetaKpi titulo="Tiempo de entrega" valor={formatoMinutos(op.tiempoPromedioEntregaMin)} detalle="de asignado a entregado" />
              </div>
              <TarjetaGrafico
                titulo="Entregas por repartidor"
                tabla={{
                  columnas: ['Repartidor', 'Entregas', 'Tiempo promedio'],
                  filas: kpis.repartidores.map((x) => [x.repartidor, x.entregas, formatoMinutos(x.tiempoPromedioEntregaMin)]),
                }}
              >
                {kpis.repartidores.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No hubo entregas en el período.</p>
                ) : (
                  <BarrasHorizontales datos={kpis.repartidores} categoria="repartidor" series={[{ clave: 'entregas', nombre: 'Entregas' }]} formato={formatoNumero} />
                )}
              </TarjetaGrafico>
            </Seccion>
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}
