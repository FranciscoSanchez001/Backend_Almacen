import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inicio from './Inicio'
import { renderizar } from '../../test/renderizar'
import { listarMisEntregas } from '../../api/repartidor'
import { marcarEnCamino, marcarEntregado } from '../../api/pedidos'
import { ErrorApi } from '../../api/cliente'

vi.mock('../../api/repartidor', () => ({ listarMisEntregas: vi.fn() }))
vi.mock('../../api/pedidos', () => ({ marcarEnCamino: vi.fn(), marcarEntregado: vi.fn() }))

const pedido = (extra = {}) => ({
  id: 'p1',
  numero: 101,
  estado: 'asignado',
  cliente: { id: 'c1', nombre: 'Ana Pérez' },
  totalUsd: 12.5,
  totalBs: 548.75,
  zona: { id: 'z1', nombre: 'Centro' },
  direccionTexto: 'Calle 5, casa 12, frente a la panadería',
  latitud: 7.7669,
  longitud: -72.225,
  telefonoContacto: '+58 412 123 4567',
  asignadoEn: '2026-10-13T14:00:00Z',
  creadoEn: '2026-10-13T13:00:00Z',
  entregadoEn: null,
  items: [
    { productoId: 'a', producto: 'Harina de maíz 1 kg', cantidad: 2 },
    { productoId: 'b', producto: 'Café molido 500 g', cantidad: 1 },
  ],
  ...extra,
})

const pagina = (items) => ({ items, total: items.length, numeroPagina: 1, tamano: 20 })
const abrir = () => renderizar(<Inicio />, { ruta: '/repartidor', rol: 'repartidor' })
const tarjeta = (numero) => screen.getByRole('article', { name: `Pedido #${numero}` })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarMisEntregas).mockResolvedValue(pagina([pedido()]))
  vi.mocked(marcarEnCamino).mockResolvedValue({})
  vi.mocked(marcarEntregado).mockResolvedValue({})
})

describe('Entregas del repartidor', () => {
  it('lista sus pedidos por entregar con dirección, zona, cliente y total', async () => {
    abrir()

    const t = await screen.findByRole('article', { name: 'Pedido #101' })
    expect(listarMisEntregas).toHaveBeenCalledWith({ historial: false, pagina: 1, tamano: 20 })
    expect(within(t).getByText(/Calle 5, casa 12/)).toBeInTheDocument()
    expect(within(t).getByText('Centro')).toBeInTheDocument()
    expect(within(t).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(t).getByText('$12.50')).toBeInTheDocument()
    expect(screen.getByText('1 por entregar')).toBeInTheDocument()
  })

  it('abre la navegación al punto exacto y permite llamar o escribir al cliente', async () => {
    abrir()
    const t = await screen.findByRole('article', { name: 'Pedido #101' })

    expect(within(t).getByRole('link', { name: /Google Maps/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=7.7669,-72.225',
    )
    expect(within(t).getByRole('link', { name: /Waze/ })).toHaveAttribute('href', 'https://waze.com/ul?ll=7.7669,-72.225&navigate=yes')
    expect(within(t).getByRole('link', { name: 'Llamar al +58 412 123 4567' })).toHaveAttribute('href', 'tel:+58 412 123 4567')
    expect(within(t).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/584121234567')
  })

  it('sin coordenadas busca la dirección escrita en el mapa', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([pedido({ latitud: null, longitud: null })]))
    abrir()
    const t = await screen.findByRole('article', { name: 'Pedido #101' })

    expect(within(t).getByRole('link', { name: /Google Maps/ }).getAttribute('href')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Calle 5, casa 12, frente a la panadería, Centro')}`,
    )
  })

  it('muestra los productos al pedirlos', async () => {
    const { user } = abrir()
    const t = await screen.findByRole('article', { name: 'Pedido #101' })

    await user.click(within(t).getByRole('button', { name: 'Ver productos (3 unidades)' }))

    expect(within(t).getByText('Harina de maíz 1 kg')).toBeInTheDocument()
    expect(within(t).getByText('× 2')).toBeInTheDocument()
  })

  it('un pedido asignado se marca en camino y la lista se actualiza', async () => {
    vi.mocked(listarMisEntregas)
      .mockResolvedValueOnce(pagina([pedido()]))
      .mockResolvedValue(pagina([pedido({ estado: 'en_camino' })]))
    const { user } = abrir()
    await screen.findByRole('article', { name: 'Pedido #101' })

    await user.click(within(tarjeta(101)).getByRole('button', { name: 'Salí a entregar' }))

    expect(marcarEnCamino).toHaveBeenCalledWith('p1')
    expect(await screen.findByText(/en camino. Le avisamos al cliente por WhatsApp/)).toBeInTheDocument()
    expect(await within(tarjeta(101)).findByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
  })

  it('marcar entregado pide confirmación y se puede cancelar', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([pedido({ estado: 'en_camino' })]))
    const { user } = abrir()
    await screen.findByRole('article', { name: 'Pedido #101' })

    await user.click(within(tarjeta(101)).getByRole('button', { name: 'Marcar entregado' }))
    const confirmar = within(tarjeta(101)).getByRole('group', { name: 'Confirmar entrega' })
    await user.click(within(confirmar).getByRole('button', { name: 'Cancelar' }))
    expect(marcarEntregado).not.toHaveBeenCalled()

    await user.click(within(tarjeta(101)).getByRole('button', { name: 'Marcar entregado' }))
    await user.click(within(tarjeta(101)).getByRole('button', { name: 'Sí, entregado' }))

    expect(marcarEntregado).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Pedido #101 entregado. ¡Buen trabajo!')).toBeInTheDocument()
  })

  it('si la API rechaza el cambio muestra el motivo', async () => {
    vi.mocked(marcarEnCamino).mockRejectedValue(new ErrorApi('El pedido ya no está asignado a ti.', 409, null))
    const { user } = abrir()
    await screen.findByRole('article', { name: 'Pedido #101' })

    await user.click(within(tarjeta(101)).getByRole('button', { name: 'Salí a entregar' }))

    expect(await screen.findByText('El pedido ya no está asignado a ti.')).toBeInTheDocument()
  })

  it('el historial pide las entregas hechas y no ofrece acciones', async () => {
    const { user } = abrir()
    await screen.findByRole('article', { name: 'Pedido #101' })
    vi.mocked(listarMisEntregas).mockResolvedValue(
      pagina([pedido({ id: 'p2', numero: 90, estado: 'entregado', entregadoEn: '2026-10-12T18:30:00Z' })]),
    )

    await user.click(screen.getByRole('button', { name: 'Historial' }))

    await waitFor(() => expect(listarMisEntregas).toHaveBeenLastCalledWith({ historial: true, pagina: 1, tamano: 20 }))
    const t = await screen.findByRole('article', { name: 'Pedido #90' })
    expect(within(t).getByText(/Entregado el/)).toBeInTheDocument()
    expect(within(t).queryByRole('button', { name: /Salí a entregar|Marcar entregado/ })).not.toBeInTheDocument()
    expect(within(t).queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument()
  })

  it('sin pedidos asignados lo explica', async () => {
    vi.mocked(listarMisEntregas).mockResolvedValue(pagina([]))
    abrir()

    expect(await screen.findByText(/No tienes pedidos por entregar/)).toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(listarMisEntregas).mockRejectedValueOnce(new ErrorApi('Sin conexión', 0, null))
    const { user } = abrir()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('article', { name: 'Pedido #101' })).toBeInTheDocument()
  })
})
