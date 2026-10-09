import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Pedidos from './Pedidos'
import {
  aprobarPedido,
  listarPedidos,
  listarRepartidores,
  marcarEnCamino,
  marcarEntregado,
  rechazarPedido,
} from '../../api/pedidos'
import { ErrorApi } from '../../api/cliente'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/pedidos', () => ({
  aprobarPedido: vi.fn(),
  listarPedidos: vi.fn(),
  listarRepartidores: vi.fn(),
  marcarEnCamino: vi.fn(),
  marcarEntregado: vi.fn(),
  rechazarPedido: vi.fn(),
}))

function crearPedido(numero, cambios = {}) {
  return {
    id: `ped-${numero}`,
    numero,
    estado: 'pendiente',
    creadoEn: '2026-10-05T14:30:00Z',
    expiraEn: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    cliente: { nombre: `Cliente ${numero}` },
    zona: { nombre: 'Centro' },
    metodoPago: 'transferencia',
    monedaPago: 'VES',
    referenciaPago: `REF-${numero}`,
    items: [{ productoId: 'p1', producto: 'Arroz', categoria: 'Víveres', cantidad: 2, precioUsd: 1.5, subtotalUsd: 3 }],
    totalUsd: 3,
    totalBs: 705.42,
    tasaCambio: 235.14,
    telefonoContacto: '04141234567',
    direccionTexto: 'Calle 1',
    historial: [],
    ...cambios,
  }
}

const repartidores = [
  { id: 'rep-1', nombre: 'Luis Gómez', pedidosEnCurso: 2 },
  { id: 'rep-2', nombre: 'Pedro Díaz', pedidosEnCurso: 0 },
]

const dialogo = () => screen.getByRole('dialog')

async function abrirPedido(user, numero) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`Pedido #${numero}`) }))
  return dialogo()
}

beforeEach(() => {
  vi.mocked(listarPedidos).mockReset()
  vi.mocked(listarRepartidores).mockReset().mockResolvedValue(repartidores)
  vi.mocked(aprobarPedido).mockReset()
  vi.mocked(rechazarPedido).mockReset()
  vi.mocked(marcarEnCamino).mockReset()
  vi.mocked(marcarEntregado).mockReset()
})

describe('Pedidos: listado y filtros', () => {
  it('por defecto pide la bandeja de pendientes, página 1', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))

    renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })

    expect(await screen.findByText('Pedido #101')).toBeInTheDocument()
    expect(listarPedidos).toHaveBeenCalledWith({ estado: 'pendiente', pagina: 1, tamano: 20 })
    expect(screen.getByRole('button', { name: 'Pendiente', pressed: true })).toBeInTheDocument()
  })

  it('cada tarjeta muestra cliente, método de pago, productos, totales y tiempo restante', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))

    renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })

    const tarjeta = await screen.findByRole('button', { name: /Pedido #101/ })
    expect(tarjeta).toHaveTextContent('Cliente 101')
    expect(tarjeta).toHaveTextContent('Transferencia')
    expect(tarjeta).toHaveTextContent('1 producto')
    expect(tarjeta).toHaveTextContent('$3.00')
    expect(tarjeta).toHaveTextContent('Bs 705,42')
    expect(tarjeta).toHaveTextContent(/Vence en/)
    expect(screen.getByText('1 pedidos')).toBeInTheDocument()
  })

  it('fuera de pendientes la tarjeta muestra la etiqueta de estado y el repartidor', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(
      pagina([crearPedido(201, { estado: 'entregado', repartidor: { nombre: 'Luis Gómez' } })]),
    )

    renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=entregado', patron: '/panel/pedidos', rol: 'ventas' })

    const tarjeta = await screen.findByRole('button', { name: /Pedido #201/ })
    expect(tarjeta).toHaveTextContent('Entregado')
    expect(tarjeta).toHaveTextContent('Luis Gómez')
    expect(tarjeta).not.toHaveTextContent(/Vence en/)
  })

  it('al cambiar de estado pide los pedidos de ese estado desde la página 1', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?pagina=3', patron: '/panel/pedidos', rol: 'ventas' })
    await screen.findByText('¡Todo al día! No hay pedidos por revisar.')

    await user.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: 'En camino' }))

    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith({ estado: 'en_camino', pagina: 1, tamano: 20 }))
    expect(await screen.findByText('No hay pedidos en este estado.')).toBeInTheDocument()
  })

  it('pagina los resultados de 20 en 20', async () => {
    const items = Array.from({ length: 20 }, (_, i) => crearPedido(300 + i))
    vi.mocked(listarPedidos).mockResolvedValue(pagina(items, { total: 45 }))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    await waitFor(() => expect(listarPedidos).toHaveBeenLastCalledWith({ estado: 'pendiente', pagina: 2, tamano: 20 }))
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(listarPedidos).mockRejectedValueOnce(new ErrorApi('El servicio no está disponible en este momento.', 503, null))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })

    expect(await screen.findByText('El servicio no está disponible en este momento.')).toBeInTheDocument()
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Pedido #101')).toBeInTheDocument()
  })
})

describe('Pedidos: detalle', () => {
  it('al tocar una tarjeta abre el detalle del pedido', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })

    const modal = await abrirPedido(user, 101)

    expect(within(modal).getByRole('heading', { name: 'Pedido #101' })).toBeInTheDocument()
    expect(within(modal).getByText('REF-101')).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
  })

  it('el botón Cerrar cierra el detalle', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)

    await user.click(within(modal).getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Pedidos: aprobar', () => {
  it('exige elegir un repartidor antes de aprobar', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)

    await user.click(within(modal).getByRole('button', { name: 'Aprobar' }))

    const selector = await within(modal).findByLabelText('Repartidor que lo entregará')
    await within(modal).findByRole('option', { name: 'Luis Gómez · 2 en curso' })
    expect(selector).toBeRequired()
    expect(within(modal).getByRole('button', { name: 'Aprobar y asignar' })).toBeDisabled()
    expect(listarRepartidores).toHaveBeenCalledOnce()
  })

  it('aprueba con el repartidor elegido, quita el pedido de la bandeja y avisa', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101), crearPedido(102)]))
    vi.mocked(aprobarPedido).mockResolvedValue(crearPedido(101, { estado: 'asignado' }))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)
    await user.click(within(modal).getByRole('button', { name: 'Aprobar' }))
    await within(modal).findByRole('option', { name: 'Pedro Díaz · 0 en curso' })

    await user.selectOptions(within(modal).getByLabelText('Repartidor que lo entregará'), 'rep-2')
    await user.click(within(modal).getByRole('button', { name: 'Aprobar y asignar' }))

    expect(aprobarPedido).toHaveBeenCalledWith('ped-101', 'rep-2')
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #101 aprobado y asignado.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Pedido #101')).not.toBeInTheDocument()
    expect(screen.getByText('Pedido #102')).toBeInTheDocument()
    expect(screen.getByText('1 pedidos')).toBeInTheDocument()
  })

  it('si la API rechaza la aprobación muestra el error y deja el pedido abierto', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    vi.mocked(aprobarPedido).mockRejectedValue(new ErrorApi('El pedido ya no está pendiente.', 409, null))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)
    await user.click(within(modal).getByRole('button', { name: 'Aprobar' }))
    await within(modal).findByRole('option', { name: 'Luis Gómez · 2 en curso' })

    await user.selectOptions(within(modal).getByLabelText('Repartidor que lo entregará'), 'rep-1')
    await user.click(within(modal).getByRole('button', { name: 'Aprobar y asignar' }))

    expect(await within(modal).findByRole('alert')).toHaveTextContent('El pedido ya no está pendiente.')
    expect(within(modal).getByRole('button', { name: 'Aprobar y asignar' })).toBeEnabled()
  })

  it('si no se pueden cargar los repartidores lo informa', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    vi.mocked(listarRepartidores).mockRejectedValue(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)

    await user.click(within(modal).getByRole('button', { name: 'Aprobar' }))

    expect(await within(modal).findByRole('alert')).toHaveTextContent('No tienes permiso para hacer esto.')
    expect(within(modal).getByLabelText('Repartidor que lo entregará')).toBeDisabled()
  })

  it('Volver regresa a las opciones de aprobar o rechazar', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)
    await user.click(within(modal).getByRole('button', { name: 'Aprobar' }))

    await user.click(within(modal).getByRole('button', { name: 'Volver' }))

    expect(within(modal).getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(within(modal).queryByLabelText('Repartidor que lo entregará')).not.toBeInTheDocument()
  })
})

describe('Pedidos: rechazar', () => {
  it('propone el motivo por defecto y rechaza con el motivo escrito', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    vi.mocked(rechazarPedido).mockResolvedValue(crearPedido(101, { estado: 'rechazado' }))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)
    await user.click(within(modal).getByRole('button', { name: 'Rechazar' }))
    const motivo = within(modal).getByLabelText('Motivo del rechazo')
    expect(motivo).toHaveValue('El método de pago no procede.')

    await user.clear(motivo)
    await user.type(motivo, 'La referencia no existe.')
    await user.click(within(modal).getByRole('button', { name: 'Rechazar pedido' }))

    expect(rechazarPedido).toHaveBeenCalledWith('ped-101', 'La referencia no existe.')
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #101 rechazado. El stock volvió a la tienda.')
    expect(screen.queryByText('Pedido #101')).not.toBeInTheDocument()
  })

  it('si la API falla muestra el error', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(101)]))
    vi.mocked(rechazarPedido).mockRejectedValue(new ErrorApi('No se pudo conectar con el servidor.', 0, null))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos', rol: 'ventas' })
    const modal = await abrirPedido(user, 101)
    await user.click(within(modal).getByRole('button', { name: 'Rechazar' }))

    await user.click(within(modal).getByRole('button', { name: 'Rechazar pedido' }))

    expect(await within(modal).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })
})

describe('Pedidos: avance de la entrega según el rol', () => {
  it('ventas no puede marcar en camino un pedido asignado', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(201, { estado: 'asignado' })]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=asignado', patron: '/panel/pedidos', rol: 'ventas' })

    const modal = await abrirPedido(user, 201)

    expect(within(modal).queryByRole('button', { name: /Marcar/ })).not.toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
  })

  it('el gerente marca en camino un pedido asignado', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(201, { estado: 'asignado' })]))
    vi.mocked(marcarEnCamino).mockResolvedValue(crearPedido(201, { estado: 'en_camino' }))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=asignado', patron: '/panel/pedidos', rol: 'superadmin' })
    const modal = await abrirPedido(user, 201)

    await user.click(within(modal).getByRole('button', { name: 'Marcar en camino' }))

    expect(marcarEnCamino).toHaveBeenCalledWith('ped-201')
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #201 en camino.')
  })

  it('el gerente marca entregado un pedido en camino', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(202, { estado: 'en_camino' })]))
    vi.mocked(marcarEntregado).mockResolvedValue(crearPedido(202, { estado: 'entregado' }))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=en_camino', patron: '/panel/pedidos', rol: 'superadmin' })
    const modal = await abrirPedido(user, 202)

    await user.click(within(modal).getByRole('button', { name: 'Marcar entregado' }))

    expect(marcarEntregado).toHaveBeenCalledWith('ped-202')
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #202 entregado.')
  })

  it('ventas no puede marcar entregado un pedido en camino', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(202, { estado: 'en_camino' })]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=en_camino', patron: '/panel/pedidos', rol: 'ventas' })

    const modal = await abrirPedido(user, 202)

    expect(within(modal).queryByRole('button', { name: 'Marcar entregado' })).not.toBeInTheDocument()
  })

  it('un pedido entregado no tiene acciones', async () => {
    vi.mocked(listarPedidos).mockResolvedValue(pagina([crearPedido(203, { estado: 'entregado' })]))
    const { user } = renderizar(<Pedidos />, { ruta: '/panel/pedidos?estado=entregado', patron: '/panel/pedidos', rol: 'superadmin' })

    const modal = await abrirPedido(user, 203)

    expect(within(modal).queryByRole('button', { name: /Marcar|Aprobar|Rechazar/ })).not.toBeInTheDocument()
  })
})
