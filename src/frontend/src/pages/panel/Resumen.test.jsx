import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Resumen from './Resumen'
import { listarPedidos } from '../../api/pedidos'
import { listarInventario } from '../../api/inventario'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../../api/notificaciones'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/pedidos', () => ({ listarPedidos: vi.fn() }))
vi.mock('../../api/inventario', () => ({ listarInventario: vi.fn() }))
vi.mock('../../api/notificaciones', () => ({
  listarNotificaciones: vi.fn(),
  marcarLeida: vi.fn(),
  marcarTodasLeidas: vi.fn(),
}))

const enUnaHora = () => new Date(Date.now() + 2 * 60 * 60_000).toISOString()

const pedidoPendiente = (numero, cliente) => ({
  id: `ped-${numero}`,
  numero,
  cliente: { nombre: cliente },
  totalUsd: 12.5,
  zona: { nombre: 'Centro' },
  expiraEn: enUnaHora(),
})

const inventario = [
  { productoId: 'a', nombre: 'Arroz', stockDisponible: 0, stockMinimo: 5 },
  { productoId: 'b', nombre: 'Harina', stockDisponible: 0, stockMinimo: 5 },
  { productoId: 'c', nombre: 'Leche', stockDisponible: 3, stockMinimo: 5 },
  { productoId: 'd', nombre: 'Café', stockDisponible: 40, stockMinimo: 5 },
]

const avisos = [
  { id: 'n1', tipo: 'stock_agotado', producto: 'Arroz', creadoEn: '2026-10-05T14:30:00Z' },
  { id: 'n2', tipo: 'pedido_nuevo', creadoEn: '2026-10-05T15:00:00Z' },
  { id: 'n3', tipo: 'pedido_por_expirar', creadoEn: '2026-10-05T16:00:00Z' },
]

function simularDatos({ pendientes = [pedidoPendiente(101, 'Ana Pérez'), pedidoPendiente(102, 'Luis Gómez')], items = inventario, notificaciones = avisos } = {}) {
  vi.mocked(listarPedidos).mockResolvedValue(pagina(pendientes))
  vi.mocked(listarInventario).mockResolvedValue(items)
  vi.mocked(listarNotificaciones).mockResolvedValue(pagina(notificaciones))
}

// Valor de la tarjeta (enlace) con el título indicado.
const tarjeta = (titulo) => screen.getByText(titulo).closest('a')

beforeEach(() => {
  vi.mocked(listarPedidos).mockReset()
  vi.mocked(listarInventario).mockReset()
  vi.mocked(listarNotificaciones).mockReset()
  vi.mocked(marcarLeida).mockReset().mockResolvedValue(null)
  vi.mocked(marcarTodasLeidas).mockReset().mockResolvedValue(null)
})

describe('Resumen', () => {
  it('saluda al usuario por su primer nombre', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas', nombre: 'María Fernanda' })

    expect(await screen.findByRole('heading', { name: /Hola, María/ })).toBeInTheDocument()
  })

  it('pide los pendientes más urgentes, el inventario y los avisos', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    await screen.findByText('Pedidos por revisar')
    expect(listarPedidos).toHaveBeenCalledWith({ estado: 'pendiente', tamano: 5 })
    expect(listarInventario).toHaveBeenCalled()
    expect(listarNotificaciones).toHaveBeenCalled()
  })

  it('muestra los contadores de pedidos, agotados, bajo el mínimo y avisos', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    await screen.findByText('Pedidos por revisar')
    expect(within(tarjeta('Pedidos por revisar')).getByText('2')).toBeInTheDocument()
    expect(within(tarjeta('Productos agotados')).getByText('2')).toBeInTheDocument()
    expect(within(tarjeta('Bajo el stock mínimo')).getByText('1')).toBeInTheDocument()
    expect(within(tarjeta('Avisos sin leer')).getByText('3')).toBeInTheDocument()
  })

  it('cada tarjeta enlaza a la pantalla donde se atiende', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    await screen.findByText('Pedidos por revisar')
    expect(tarjeta('Pedidos por revisar')).toHaveAttribute('href', '/panel/pedidos')
    expect(tarjeta('Productos agotados')).toHaveAttribute('href', '/panel/inventario')
    expect(tarjeta('Bajo el stock mínimo')).toHaveAttribute('href', '/panel/inventario')
  })

  it('lista los pedidos más urgentes con número, cliente y tiempo restante', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    expect(await screen.findByText('#101')).toBeInTheDocument()
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument()
    expect(screen.getByText('#102')).toBeInTheDocument()
    expect(screen.getAllByText(/Vence en/)).toHaveLength(2)
  })

  it('sin pedidos pendientes ni avisos lo indica', async () => {
    simularDatos({ pendientes: [], notificaciones: [] })

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    expect(await screen.findByText('¡Todo al día! No hay pedidos pendientes.')).toBeInTheDocument()
    expect(screen.getByText('No hay avisos sin leer.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar todos como leídos' })).not.toBeInTheDocument()
  })

  it('describe cada tipo de aviso', async () => {
    simularDatos()

    renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    expect(await screen.findByText(/Se agotó Arroz/)).toBeInTheDocument()
    expect(screen.getByText(/Llegó un pedido nuevo/)).toBeInTheDocument()
    expect(screen.getByText(/Un pedido está por expirar/)).toBeInTheDocument()
  })

  it('marcar un aviso como leído lo informa a la API y recarga', async () => {
    simularDatos()
    const { user } = renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })
    await screen.findByText(/Se agotó Arroz/)

    await user.click(screen.getAllByRole('button', { name: 'Leído' })[0])

    expect(marcarLeida).toHaveBeenCalledWith('n1')
    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalledTimes(2))
  })

  it('marcar todos como leídos lo informa a la API y recarga', async () => {
    simularDatos()
    const { user } = renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })
    await screen.findByText(/Se agotó Arroz/)

    await user.click(screen.getByRole('button', { name: 'Marcar todos como leídos' }))

    expect(marcarTodasLeidas).toHaveBeenCalledOnce()
    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalledTimes(2))
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(listarPedidos).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor.'))
    vi.mocked(listarInventario).mockResolvedValue(inventario)
    vi.mocked(listarNotificaciones).mockResolvedValue(pagina(avisos))
    const { user } = renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument()
    vi.mocked(listarPedidos).mockResolvedValue(pagina([pedidoPendiente(101, 'Ana Pérez')]))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('#101')).toBeInTheDocument()
  })

  it('el botón Actualizar vuelve a cargar los datos', async () => {
    simularDatos()
    const { user } = renderizar(<Resumen />, { ruta: '/panel', rol: 'ventas' })
    await screen.findByText('Pedidos por revisar')

    await user.click(screen.getByRole('button', { name: 'Actualizar' }))

    await waitFor(() => expect(listarPedidos).toHaveBeenCalledTimes(2))
  })
})
