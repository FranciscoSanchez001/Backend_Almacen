import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inicio from './Inicio'
import { renderizar } from '../../test/renderizar'
import { obtenerPedido, marcarEnCamino, marcarEntregado } from '../../api/pedidos'
import { listarMisEntregas } from '../../api/repartidor'
import { ErrorApi } from '../../api/cliente'

vi.mock('../../api/repartidor', () => ({ listarMisEntregas: vi.fn() }))
vi.mock('../../api/pedidos', () => ({
  obtenerPedido: vi.fn(), marcarEnCamino: vi.fn(), marcarEntregado: vi.fn(),
}))

const asignado = {
  id: 'p1', numero: 42, estado: 'asignado', cliente: { nombre: 'María' }, zona: { nombre: 'Centro' },
  direccionTexto: 'Casa azul #2', telefonoContacto: '+584121234567', totalUsd: 4,
  creadoEn: '2026-10-14T12:00:00Z', asignadoEn: '2026-10-14T13:00:00Z',
  latitud: null, longitud: null, items: [{ productoId: 'i1', producto: 'Arroz', cantidad: 2 }],
  historial: [{ estadoNuevo: 'asignado', creadoEn: '2026-10-14T13:00:00Z' }],
}
const enCamino = { ...asignado, estado: 'en_camino' }
const entregado = { ...asignado, estado: 'entregado', entregadoEn: '2026-10-14T14:00:00Z' }
const pagina = (items, total = items.length) => ({ items, total })
const montar = (ruta = '/repartidor', rol = 'repartidor') => renderizar(<Inicio />, { ruta, rol })

beforeEach(() => {
  vi.mocked(listarMisEntregas).mockReset().mockResolvedValue(pagina([asignado]))
  vi.mocked(obtenerPedido).mockReset().mockResolvedValue(asignado)
  vi.mocked(marcarEnCamino).mockReset().mockResolvedValue(enCamino)
  vi.mocked(marcarEntregado).mockReset().mockResolvedValue(entregado)
})

async function abrir() {
  const vista = montar()
  await vista.user.click(await screen.findByRole('button', { name: 'Ver pedido #42' }))
  await screen.findByRole('button', { name: 'Iniciar entrega' })
  return vista
}

describe('Entregas del repartidor', () => {
  it('consulta sus entregas y muestra cliente, dirección y estado', async () => {
    montar()
    const tarjeta = await screen.findByRole('button', { name: 'Ver pedido #42' })
    expect(tarjeta).toHaveTextContent('María')
    expect(tarjeta).toHaveTextContent('Centro · Casa azul #2')
    expect(tarjeta).toHaveTextContent('Asignado')
    expect(listarMisEntregas).toHaveBeenCalledWith({ historial: false, pagina: 1, tamano: 20 })
    expect(screen.queryByText('Por construir')).not.toBeInTheDocument()
  })

  it('el gerente accede al panel general sin llamar al endpoint exclusivo del repartidor', () => {
    montar('/repartidor', 'superadmin')
    expect(screen.getByRole('link', { name: 'Ir a pedidos' })).toHaveAttribute('href', '/panel/pedidos')
    expect(listarMisEntregas).not.toHaveBeenCalled()
  })

  it('cambia de página y reinicia la paginación al abrir el historial', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([asignado], 21))
    const { user } = montar()
    await screen.findByRole('button', { name: 'Ver pedido #42' })
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: false, pagina: 2, tamano: 20 }))
    await screen.findByRole('button', { name: 'Ver pedido #42' })
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([entregado]))
    await user.click(screen.getByRole('button', { name: 'Historial', exact: true }))
    await waitFor(() => expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: true, pagina: 1, tamano: 20 }))
    expect(await screen.findByRole('button', { name: 'Ver pedido #42' })).toHaveTextContent('Entregado')
  })

  it('recupera la última página válida si ya no hay pedidos en la página actual', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValueOnce(pagina([])).mockResolvedValue(pagina([asignado]))
    montar('/repartidor?pagina=2')
    await screen.findByRole('button', { name: 'Ver pedido #42' })
    expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: false, pagina: 1, tamano: 20 })
  })

  it('muestra un listado vacío y permite reintentar tras un error', async () => {
    vi.mocked(listarMisEntregas).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(pagina([]))
    const { user } = montar()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No tienes pedidos pendientes de entrega.')).toBeInTheDocument()
  })

  it('muestra detalle actualizado, productos, teléfono y mapas con dirección escrita', async () => {
    const { user } = await abrir()
    expect(obtenerPedido).toHaveBeenCalledWith('p1')
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Arroz')).toBeInTheDocument()
    expect(within(dialogo).getByRole('link', { name: 'Llamar al cliente' })).toHaveAttribute('href', 'tel:+584121234567')
    expect(new URL(within(dialogo).getByRole('link', { name: 'Google Maps' }).href).searchParams.get('query')).toBe('Casa azul #2, Centro, Venezuela')
    expect(within(dialogo).getByRole('link', { name: 'Waze' })).toHaveAttribute('target', '_blank')
    expect(within(dialogo).getByRole('heading', { name: 'Historial de estados' })).toBeInTheDocument()
    fireEvent(dialogo, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver pedido #42' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Ver pedido #42' }))
    await screen.findByRole('button', { name: 'Iniciar entrega' })
  })

  it('permite cancelar la confirmación sin cambiar el estado', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: 'Iniciar entrega' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(marcarEnCamino).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Iniciar entrega' })).toBeInTheDocument()
  })

  it('avanza de asignado a en camino y luego entregado, refrescando la lista y el historial', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: 'Iniciar entrega' }))
    expect(marcarEnCamino).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar salida' }))
    expect(await screen.findByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
    expect(marcarEnCamino).toHaveBeenCalledWith('p1')
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([]))
    await user.click(screen.getByRole('button', { name: 'Marcar entregado' }))
    expect(marcarEntregado).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(marcarEntregado).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('No tienes pedidos pendientes de entrega.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pedido #42 entregado.')
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([entregado]))
    vi.mocked(obtenerPedido).mockResolvedValue(entregado)
    await user.click(screen.getByRole('button', { name: 'Historial', exact: true }))
    await user.click(await screen.findByRole('button', { name: 'Ver pedido #42' }))
    expect(await screen.findByText('Esta entrega ya está finalizada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar entregado' })).not.toBeInTheDocument()
  })

  it('respeta el estado actualizado del servidor aunque la tarjeta conserve el anterior', async () => {
    vi.mocked(obtenerPedido).mockResolvedValue(enCamino)
    const { user } = montar()
    await user.click(await screen.findByRole('button', { name: 'Ver pedido #42' }))
    expect(await screen.findByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar entrega' })).not.toBeInTheDocument()
  })

  it('bloquea envíos duplicados y el cierre mientras se confirma la salida', async () => {
    let resolver
    vi.mocked(marcarEnCamino).mockReturnValue(new Promise(resolve => { resolver = resolve }))
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: 'Iniciar entrega' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar salida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }))
    expect(marcarEnCamino).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Cerrar detalle de entrega' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => resolver(enCamino))
    expect(await screen.findByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
  })

  it('informa conflictos y exige consultar el estado actual antes de repetir', async () => {
    vi.mocked(marcarEnCamino).mockRejectedValue(new ErrorApi('El estado cambió.', 409))
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: 'Iniciar entrega' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar salida' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El estado cambió.')
    expect(screen.getByRole('button', { name: 'Iniciar entrega' })).toBeDisabled()
    vi.mocked(obtenerPedido).mockResolvedValue(enCamino)
    await user.click(screen.getByRole('button', { name: 'Actualizar entrega' }))
    expect(await screen.findByRole('button', { name: 'Marcar entregado' })).toBeEnabled()
  })

  it('no muestra acciones si el backend rechaza el acceso al pedido y permite consultar otra vez', async () => {
    vi.mocked(obtenerPedido).mockRejectedValueOnce(new ErrorApi('Pedido no encontrado.', 404)).mockResolvedValue(asignado)
    const { user } = montar()
    await user.click(await screen.findByRole('button', { name: 'Ver pedido #42' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido no encontrado.')
    expect(screen.queryByRole('button', { name: 'Iniciar entrega' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actualizar entrega' }))
    expect(await screen.findByRole('button', { name: 'Iniciar entrega' })).toBeInTheDocument()
  })

  it('ignora una respuesta de la pestaña anterior cuando el usuario abre el historial', async () => {
    let resolverAnterior
    vi.mocked(listarMisEntregas).mockReturnValueOnce(new Promise(resolve => { resolverAnterior = resolve })).mockResolvedValue(pagina([entregado]))
    const { user } = montar()
    await user.click(screen.getByRole('button', { name: 'Historial', exact: true }))
    expect(await screen.findByRole('button', { name: 'Ver pedido #42' })).toHaveTextContent('Entregado')
    await act(async () => resolverAnterior(pagina([{ ...asignado, numero: 99 }])))
    expect(screen.queryByRole('button', { name: 'Ver pedido #99' })).not.toBeInTheDocument()
  })
})
