import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PowerBIDashboard from './PowerBIDashboard'
import { descargarExcel, obtenerKpis } from '../../api/reportes'
import { listarTodosLosProductos } from '../../api/productos'
import { listarInventario } from '../../api/inventario'
import { listarPedidos } from '../../api/pedidos'
import { listarNotificaciones } from '../../api/notificaciones'
import { ErrorApi } from '../../api/cliente'
import { formatoDia } from '../../utils/formato'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/reportes', () => ({ obtenerKpis: vi.fn(), descargarExcel: vi.fn() }))
vi.mock('../../api/productos', () => ({ listarTodosLosProductos: vi.fn() }))
vi.mock('../../api/inventario', () => ({ listarInventario: vi.fn() }))
vi.mock('../../api/pedidos', () => ({ listarPedidos: vi.fn() }))
vi.mock('../../api/notificaciones', () => ({ listarNotificaciones: vi.fn() }))

const HOY = '2026-10-15'
const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const dia = (inicio, ventasUsd) => ({ inicio, pedidos: 3, unidades: 9, ventasUsd, ventasBs: ventasUsd * 36.5, ticketPromedioUsd: ventasUsd / 3 })
const producto = (posicion, nombre, unidades, ingresosUsd) => ({ posicion, producto: nombre, unidades, ingresosUsd })

function kpisDePrueba(cambios = {}) {
  return {
    periodo: {
      desde: '2026-10-01',
      hasta: '2026-10-31',
      enCurso: true,
      anteriorDesde: '2026-09-01',
      anteriorHasta: '2026-09-30',
      generadoEnLocal: `${HOY}T10:00:00`,
    },
    resumen: {
      actual: { ventasUsd: 1234.5, ventasBs: 45000, pedidos: 42, unidades: 120, ticketPromedioUsd: 29.39, unidadesPorPedido: 2.86 },
      anterior: { unidadesPorPedido: 2.5 },
      crecimientoVentasPct: 12.5,
      crecimientoPedidosPct: -4,
      crecimientoTicketPct: 0,
    },
    // El 20 de octubre todavía no llega: con el período en curso no debe mostrarse.
    ventasPorDia: [dia('2026-10-14', 300), dia(HOY, 150), dia('2026-10-20', 0)],
    masVendidos: [producto(1, 'Arroz', 50, 75), producto(2, 'Leche', 20, 90)],
    masVendidosPorIngresos: [producto(1, 'Leche', 20, 90), producto(2, 'Arroz', 50, 75)],
    menosVendidos: [producto(1, 'Vinagre', 1, 2)],
    categorias: [{ categoria: 'Víveres', unidades: 70, ingresosUsd: 165, porcentaje: 80 }],
    metodosPago: {
      metodos: [
        { metodo: 'pago_movil', pedidos: 30, montoUsd: 900, moneda: 'Bs', montoMoneda: 32850, porcentaje: 72.9 },
        { metodo: 'binance', pedidos: 12, montoUsd: 334.5, moneda: 'USDT', montoMoneda: 334.5, porcentaje: 27.1 },
      ],
      entraBs: 32850,
      entraUsdt: 334.5,
    },
    horasPico: { dias, pedidos: dias.map((_, d) => Array.from({ length: 24 }, (_, h) => (d === 0 && h === 10 ? 4 : 0))) },
    zonas: [{ zona: 'Centro', pedidos: 20, ingresosUsd: 600, porcentaje: 48.6 }],
    inventario: {
      rotacionGlobal: 1.8,
      productos: [{ productoId: 'r1', producto: 'Arroz', categoria: 'Víveres', unidadesVendidas: 50, stockPromedio: 25, rotacion: 2, stockDisponible: 20, agotado: false }],
    },
    operacion: {
      total: 50,
      pendientes: 5,
      aprobados: 40,
      rechazados: 3,
      expirados: 2,
      porcentajeAprobados: 88.9,
      porcentajeRechazados: 6.7,
      porcentajeExpirados: 4.4,
      tiempoPromedioAprobacionMin: 26,
      tiempoPromedioEntregaMin: 86,
    },
    repartidores: [],
    ...cambios,
  }
}

const productosAlmacen = [
  { categoria: 'Víveres', stockDisponible: 10, stockReservado: 2, costoUsd: 1, precioUsd: 1.5 },
  { categoria: 'Bebidas', stockDisponible: 4, stockReservado: 0, costoUsd: 2, precioUsd: 3 },
]
const inventario = [
  { productoId: 'i1', nombre: 'Aceite', stockDisponible: 3, stockMinimo: 5, stockMaximo: 50 },
  { productoId: 'i2', nombre: 'Agua mineral', stockDisponible: 200, stockMinimo: 5, stockMaximo: 100 },
  { productoId: 'i3', nombre: 'Harina PAN', stockDisponible: 0, stockMinimo: 5, stockMaximo: 50 },
  { productoId: 'i4', nombre: 'Pasta', stockDisponible: 20, stockMinimo: 5, stockMaximo: 50 },
]

function montar() {
  return renderizar(<PowerBIDashboard />, { ruta: '/admin', rol: 'superadmin' })
}

// La tarjeta de un KPI: su título es un <p> (los títulos de sección y de gráfico son <h3>).
const tarjetaKpi = (titulo) => screen.getByText(titulo, { selector: 'p' }).parentElement
const seccionGrafico = (titulo) => screen.getByRole('heading', { name: titulo }).closest('section')
const periodo = () => screen.getByRole('group', { name: 'Período' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 10, 0))
  vi.mocked(obtenerKpis).mockReset().mockResolvedValue(kpisDePrueba())
  vi.mocked(descargarExcel).mockReset().mockResolvedValue(undefined)
  vi.mocked(listarTodosLosProductos).mockReset().mockResolvedValue(productosAlmacen)
  vi.mocked(listarInventario).mockReset().mockResolvedValue(inventario)
  vi.mocked(listarPedidos).mockReset().mockResolvedValue({ items: [{ id: 'p1', expiraEn: '2026-10-15T15:00:00' }], total: 3 })
  vi.mocked(listarNotificaciones).mockReset().mockResolvedValue({ items: [], total: 7 })
})

describe('PowerBIDashboard: período', () => {
  it('al abrir pide los KPIs del mes en curso', async () => {
    montar()

    await screen.findByText('$1,234.50')

    expect(obtenerKpis).toHaveBeenCalledWith({ tipo: 'mensual', desde: HOY })
    expect(within(periodo()).getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['Hoy', 'diario'],
    ['Esta semana', 'semanal'],
  ])('"%s" pide el período %s', async (boton, tipo) => {
    const { user } = montar()
    await screen.findByText('$1,234.50')

    await user.click(within(periodo()).getByRole('button', { name: boton }))

    expect(obtenerKpis).toHaveBeenLastCalledWith({ tipo, desde: HOY })
  })

  it('el período personalizado usa el rango elegido', async () => {
    const { user } = montar()
    await screen.findByText('$1,234.50')

    await user.click(within(periodo()).getByRole('button', { name: 'Personalizado' }))
    expect(obtenerKpis).toHaveBeenLastCalledWith({ tipo: 'personalizado', desde: HOY, hasta: HOY })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })

    await waitFor(() =>
      expect(obtenerKpis).toHaveBeenLastCalledWith({ tipo: 'personalizado', desde: '2026-10-01', hasta: HOY }),
    )
  })

  it('un rango invertido se marca como inválido, no se consulta y no se puede descargar', async () => {
    const { user } = montar()
    await screen.findByText('$1,234.50')
    await user.click(within(periodo()).getByRole('button', { name: 'Personalizado' }))
    const llamadas = vi.mocked(obtenerKpis).mock.calls.length

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-20' } })

    expect(await screen.findByText(/Elige un rango válido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '⬇ Descargar Excel' })).toBeDisabled()
    expect(obtenerKpis).toHaveBeenCalledTimes(llamadas)
  })

  it('muestra el período consultado y el de comparación', async () => {
    montar()

    await screen.findByText('$1,234.50')

    expect(screen.getByText(/Período:/)).toHaveTextContent(
      `Período: ${formatoDia('2026-10-01')} – ${formatoDia('2026-10-31')} (en curso) · comparado con ${formatoDia('2026-09-01')} – ${formatoDia('2026-09-30')}`,
    )
  })
})

describe('PowerBIDashboard: indicadores', () => {
  it('muestra las tarjetas de ventas con sus valores formateados y la comparación', async () => {
    montar()
    await screen.findByText('$1,234.50')

    expect(tarjetaKpi('Ventas')).toHaveTextContent('$1,234.50↑ 12,5 %Bs 45.000,00')
    expect(tarjetaKpi('Pedidos vendidos')).toHaveTextContent('42↓ 4 %120 unidades')
    expect(tarjetaKpi('Ticket promedio')).toHaveTextContent('$29.39= 0 %por pedido')
    expect(tarjetaKpi('Unidades por pedido')).toHaveTextContent('2,86antes: 2,5')
  })

  it('muestra los indicadores de operación', async () => {
    montar()
    await screen.findByText('$1,234.50')

    expect(tarjetaKpi('Aprobados')).toHaveTextContent('88,9 %40 de 45 revisados')
    expect(tarjetaKpi('Expirados')).toHaveTextContent('4,4 %2 pedidos · 5 aún pendientes')
    expect(tarjetaKpi('Tiempo de aprobación')).toHaveTextContent('26 min')
    expect(tarjetaKpi('Tiempo de entrega')).toHaveTextContent('1 h 26 min')
  })

  it('calcula la valorización del almacén con el stock disponible y reservado', async () => {
    montar()
    await screen.findByText('Valor del almacén a costo')

    expect(tarjetaKpi('Valor del almacén a costo')).toHaveTextContent('$20.00')
    expect(tarjetaKpi('Valor a precio de venta')).toHaveTextContent('$30.00')
    expect(tarjetaKpi('Margen potencial')).toHaveTextContent('$10.0033,33 % sobre la venta')
    expect(tarjetaKpi('Rotación del stock')).toHaveTextContent('1,8')
  })

  it('omite en la tabla de ventas los días del período que aún no llegan', async () => {
    montar()
    await screen.findByText('$1,234.50')

    const tabla = within(seccionGrafico('Ventas por día (USD)')).getByRole('table', { hidden: true })
    const filas = within(tabla).getAllByRole('row', { hidden: true }).slice(1)
    expect(filas.map((f) => f.firstChild.textContent)).toEqual([formatoDia('2026-10-14'), formatoDia(HOY)])
  })

  it('el ranking se puede ordenar por unidades o por ingresos', async () => {
    const { user } = montar()
    await screen.findByText('$1,234.50')
    const ranking = seccionGrafico('Top 10 más vendidos')
    const productosDelRanking = () =>
      within(within(ranking).getByRole('table', { hidden: true }))
        .getAllByRole('row', { hidden: true })
        .slice(1)
        .map((f) => f.children[1].textContent)
    expect(productosDelRanking()).toEqual(['Arroz', 'Leche'])

    await user.click(within(ranking).getByRole('button', { name: 'Por ingresos' }))

    expect(productosDelRanking()).toEqual(['Leche', 'Arroz'])
  })

  it('muestra los métodos de pago en su moneda', async () => {
    montar()
    await screen.findByText('$1,234.50')

    const metodos = seccionGrafico('Métodos de pago')
    expect(metodos).toHaveTextContent('Pago móvil')
    expect(metodos).toHaveTextContent('334,5 USDT')
    expect(within(metodos).getByText('Entra en Bs').nextElementSibling).toHaveTextContent('Bs 32.850,00')
  })

  it('renderiza los gráficos y el mapa de calor sin errores', async () => {
    montar()
    await screen.findByText('$1,234.50')

    for (const titulo of ['Ventas por día (USD)', 'Ventas por categoría (USD)', 'Horas y días pico', 'Ventas por zona (USD)']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('lunes 10:00, 4 pedidos')).toBeInTheDocument()
  })

  it('sin entregas en el período lo indica', async () => {
    montar()

    expect(await screen.findByText('No hubo entregas en el período.')).toBeInTheDocument()
  })
})

describe('PowerBIDashboard: avisos y alertas de stock', () => {
  it('resume lo que necesita atención y enlaza a cada pantalla', async () => {
    montar()

    const avisos = await screen.findByRole('navigation', { name: 'Avisos del día' })

    await waitFor(() => expect(avisos).toHaveTextContent('1 agotados'))
    expect(within(avisos).getByRole('link', { name: /3 por revisar/ })).toHaveAttribute('href', '/panel/pedidos')
    expect(within(avisos).getByRole('link', { name: /1 bajo el mínimo/ })).toHaveAttribute('href', '/panel/inventario')
    expect(within(avisos).getByRole('link', { name: /7 avisos sin leer/ })).toHaveAttribute('href', '/panel#avisos')
    expect(listarPedidos).toHaveBeenCalledWith({ estado: 'pendiente', tamano: 1 })
  })

  it('lista las alertas de stock, las más urgentes primero', async () => {
    montar()
    await screen.findByText('Valor del almacén a costo')

    const alertas = seccionGrafico('Alertas de stock crítico')
    const filas = within(alertas).getAllByRole('row').slice(1)
    expect(filas.map((f) => f.firstChild.textContent)).toEqual(['Harina PAN', 'Aceite', 'Agua mineral'])
    expect(filas[0]).toHaveTextContent('Agotado')
    expect(filas[1]).toHaveTextContent('Bajo mínimo')
    expect(filas[2]).toHaveTextContent('Sobre máximo')
    expect(alertas).not.toHaveTextContent('Pasta')
  })

  it('si todo está dentro de sus umbrales lo indica', async () => {
    vi.mocked(listarInventario).mockResolvedValue([inventario[3]])
    montar()

    expect(await screen.findByText('Todo el inventario está dentro de sus umbrales.')).toBeInTheDocument()
  })
})

describe('PowerBIDashboard: Excel y errores', () => {
  it('descarga el Excel del mismo período y muestra el estado mientras se genera', async () => {
    let terminar
    vi.mocked(descargarExcel).mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    const { user } = montar()
    await screen.findByText('$1,234.50')

    await user.click(screen.getByRole('button', { name: '⬇ Descargar Excel' }))

    expect(descargarExcel).toHaveBeenCalledWith({ tipo: 'mensual', desde: HOY })
    expect(screen.getByRole('button', { name: 'Generando…' })).toBeDisabled()
    terminar()
    expect(await screen.findByRole('button', { name: '⬇ Descargar Excel' })).toBeEnabled()
  })

  it('si la descarga falla muestra el error', async () => {
    vi.mocked(descargarExcel).mockRejectedValue(new ErrorApi('No se pudo generar el informe.', 500, null))
    const { user } = montar()
    await screen.findByText('$1,234.50')

    await user.click(screen.getByRole('button', { name: '⬇ Descargar Excel' }))

    expect(await screen.findByText('No se pudo generar el informe.')).toBeInTheDocument()
  })

  it('si fallan los KPIs muestra el error y permite reintentar', async () => {
    vi.mocked(obtenerKpis)
      .mockRejectedValueOnce(new ErrorApi('El servicio no está disponible en este momento.', 503, null))
      .mockResolvedValueOnce(kpisDePrueba())
    const { user } = montar()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument()
  })
})
