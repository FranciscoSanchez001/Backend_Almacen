import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inicio from './Inicio'
import { renderizar } from '../../test/renderizar'
import { marcarEnCamino, marcarEntregado } from '../../api/pedidos'
import { listarMisEntregas } from '../../api/repartidor'
import { ErrorApi } from '../../api/cliente'

vi.mock('../../api/repartidor', () => ({ listarMisEntregas: vi.fn() }))
vi.mock('../../api/pedidos', () => ({ marcarEnCamino: vi.fn(), marcarEntregado: vi.fn() }))

const asignado = {
  id: 'p1', numero: 42, estado: 'asignado', cliente: { nombre: 'María' }, zona: { nombre: 'Centro' },
  direccionTexto: 'Casa azul #2', telefonoContacto: '+584121234567', totalUsd: 4,
  creadoEn: '2026-10-14T12:00:00Z', asignadoEn: '2026-10-14T13:00:00Z',
  latitud: null, longitud: null, items: [{ productoId: 'i1', producto: 'Arroz', cantidad: 2 }],
}
const enCamino = { ...asignado, estado: 'en_camino' }
const entregado = { ...asignado, estado: 'entregado', entregadoEn: '2026-10-14T14:00:00Z' }
const pagina = (items, total = items.length) => ({ items, total })
const montar = (ruta = '/repartidor', rol = 'repartidor') => renderizar(<Inicio />, { ruta, rol })
const tarjeta = (numero = 42) => screen.findByRole('article', { name: `Pedido #${numero}` })

beforeEach(() => {
  vi.mocked(listarMisEntregas).mockReset().mockResolvedValue(pagina([asignado]))
  vi.mocked(marcarEnCamino).mockReset().mockResolvedValue(enCamino)
  vi.mocked(marcarEntregado).mockReset().mockResolvedValue(entregado)
})

describe('Entregas del repartidor', () => {
  it('muestra en la tarjeta cliente, dirección, estado y el botón para iniciar la entrega', async () => {
    montar()

    const t = await tarjeta()
    expect(t).toHaveTextContent('María')
    expect(t).toHaveTextContent('Centro · Casa azul #2')
    expect(t).toHaveTextContent('Asignado')
    expect(within(t).getByRole('button', { name: 'Iniciar entrega' })).toBeEnabled()
    expect(screen.getByText('1 entrega en curso')).toBeInTheDocument()
    expect(listarMisEntregas).toHaveBeenCalledWith({ historial: false, pagina: 1, tamano: 20 })
  })

  it('ofrece Google Maps, llamar y WhatsApp, sin Waze', async () => {
    montar()
    const t = await tarjeta()

    expect(new URL(within(t).getByRole('link', { name: /Google Maps/ }).href).searchParams.get('query')).toBe('Casa azul #2, Centro, Venezuela')
    expect(within(t).getByRole('link', { name: 'Llamar al +584121234567' })).toHaveAttribute('href', 'tel:+584121234567')
    expect(within(t).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/584121234567')
    expect(within(t).queryByRole('link', { name: /Waze/ })).not.toBeInTheDocument()
  })

  it('muestra los productos al pedirlos', async () => {
    const { user } = montar()
    const t = await tarjeta()

    await user.click(within(t).getByRole('button', { name: 'Ver productos (2 unidades)' }))

    expect(within(t).getByText('Arroz')).toBeInTheDocument()
    expect(within(t).getByText('× 2')).toBeInTheDocument()
  })

  it('iniciar la entrega cambia el botón a "Marcar como entregado" en la misma tarjeta', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValueOnce(pagina([asignado])).mockResolvedValue(pagina([enCamino]))
    const { user } = montar()

    await user.click(within(await tarjeta()).getByRole('button', { name: 'Iniciar entrega' }))

    expect(marcarEnCamino).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Pedido #42 en camino. Le avisamos al cliente por WhatsApp.')).toBeInTheDocument()
    const t = await tarjeta()
    expect(await within(t).findByRole('button', { name: 'Marcar como entregado' })).toBeInTheDocument()
    expect(within(t).queryByRole('button', { name: 'Iniciar entrega' })).not.toBeInTheDocument()
  })

  it('marcar como entregado lo saca de las entregas en curso', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValueOnce(pagina([enCamino])).mockResolvedValue(pagina([]))
    const { user } = montar()

    await user.click(within(await tarjeta()).getByRole('button', { name: 'Marcar como entregado' }))

    expect(marcarEntregado).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Pedido #42 entregado.')).toBeInTheDocument()
    expect(await screen.findByText('No tienes pedidos pendientes de entrega.')).toBeInTheDocument()
  })

  it('bloquea un segundo toque mientras se guarda', async () => {
    let terminar
    vi.mocked(marcarEnCamino).mockReturnValue(new Promise((r) => (terminar = r)))
    const { user } = montar()
    const t = await tarjeta()

    await user.click(within(t).getByRole('button', { name: 'Iniciar entrega' }))
    const boton = within(t).getByRole('button', { name: 'Guardando…' })
    expect(boton).toBeDisabled()
    await user.click(boton)
    expect(marcarEnCamino).toHaveBeenCalledTimes(1)
    await act(async () => terminar(enCamino))
  })

  it('si la API rechaza el cambio muestra el motivo y vuelve a consultar la lista', async () => {
    vi.mocked(marcarEnCamino).mockRejectedValue(new ErrorApi('El pedido ya no está asignado a ti.', 409, null))
    const { user } = montar()

    await user.click(within(await tarjeta()).getByRole('button', { name: 'Iniciar entrega' }))

    expect(await screen.findByText('El pedido ya no está asignado a ti.')).toBeInTheDocument()
    await waitFor(() => expect(listarMisEntregas).toHaveBeenCalledTimes(2))
  })

  it('el gerente accede al panel general sin llamar al endpoint exclusivo del repartidor', () => {
    montar('/repartidor', 'superadmin')
    expect(screen.getByRole('link', { name: 'Ir a pedidos' })).toHaveAttribute('href', '/panel/pedidos')
    expect(listarMisEntregas).not.toHaveBeenCalled()
  })

  it('cambia de página y reinicia la paginación al abrir el historial, que no tiene acciones', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([asignado], 21))
    const { user } = montar()
    await tarjeta()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: false, pagina: 2, tamano: 20 }))

    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([entregado]))
    await user.click(screen.getByRole('button', { name: 'Historial', exact: true }))

    await waitFor(() => expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: true, pagina: 1, tamano: 20 }))
    const t = await tarjeta()
    expect(t).toHaveTextContent('Entregado')
    expect(within(t).queryByRole('button', { name: /Iniciar entrega|Marcar como entregado/ })).not.toBeInTheDocument()
    expect(within(t).queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument()
  })

  it('recupera la última página válida si ya no hay pedidos en la página actual', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValueOnce(pagina([])).mockResolvedValue(pagina([asignado]))
    montar('/repartidor?pagina=2')
    await tarjeta()
    expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: false, pagina: 1, tamano: 20 })
  })

  it('muestra un listado vacío y permite reintentar tras un error', async () => {
    vi.mocked(listarMisEntregas).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(pagina([]))
    const { user } = montar()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No tienes pedidos pendientes de entrega.')).toBeInTheDocument()
  })

  it('ignora una respuesta de la pestaña anterior cuando el usuario abre el historial', async () => {
    let resolverAnterior
    vi.mocked(listarMisEntregas)
      .mockReturnValueOnce(new Promise((resolve) => (resolverAnterior = resolve)))
      .mockResolvedValue(pagina([entregado]))
    const { user } = montar()
    await user.click(screen.getByRole('button', { name: 'Historial', exact: true }))
    expect(await tarjeta()).toHaveTextContent('Entregado')
    await act(async () => resolverAnterior(pagina([{ ...asignado, numero: 99 }])))
    expect(screen.queryByRole('article', { name: 'Pedido #99' })).not.toBeInTheDocument()
  })
})
