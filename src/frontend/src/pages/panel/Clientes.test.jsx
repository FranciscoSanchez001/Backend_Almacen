import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Clientes from './Clientes'
import { buscarClientes, pedidosDeCliente } from '../../api/clientes'
import { ErrorApi } from '../../api/cliente'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/clientes', () => ({ buscarClientes: vi.fn(), pedidosDeCliente: vi.fn() }))

const clientes = [
  { id: 'c1', nombre: 'Ana Pérez', email: 'ana@correo.com', telefono: '04141234567', pedidos: 3 },
  { id: 'c2', nombre: 'Luis Gómez', email: 'luis@correo.com', telefono: null, pedidos: 0 },
]

function crearPedido(numero, cambios = {}) {
  return {
    id: `ped-${numero}`,
    numero,
    estado: 'entregado',
    creadoEn: '2026-10-05T14:30:00Z',
    items: [{ productoId: 'p1', producto: 'Arroz', categoria: 'Víveres', cantidad: 2, precioUsd: 1.5, subtotalUsd: 3 }],
    totalUsd: 3,
    totalBs: 705.42,
    tasaCambio: 235.14,
    metodoPago: 'pago_movil',
    referenciaPago: `REF-${numero}`,
    zona: { nombre: 'Centro' },
    cliente: { nombre: 'Ana Pérez' },
    historial: [],
    ...cambios,
  }
}

beforeEach(() => {
  vi.mocked(buscarClientes).mockReset().mockResolvedValue(pagina(clientes))
  vi.mocked(pedidosDeCliente).mockReset()
})

describe('Clientes: listado y búsqueda', () => {
  it('carga la primera página de clientes sin filtro', async () => {
    renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@correo.com · 3 pedidos')).toBeInTheDocument()
    expect(buscarClientes).toHaveBeenCalledWith({ buscar: '', pagina: 1, tamano: 20 })
    expect(screen.getByText('Elige un cliente para ver sus compras.')).toBeInTheDocument()
  })

  it('busca por el texto escrito, sin espacios sobrantes, después de una pausa', async () => {
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })
    await screen.findByText('Ana Pérez')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar clientes' }), '  ana ')

    await waitFor(() => expect(buscarClientes).toHaveBeenLastCalledWith({ buscar: 'ana', pagina: 1, tamano: 20 }), {
      timeout: 2000,
    })
    expect(buscarClientes).not.toHaveBeenCalledWith(expect.objectContaining({ buscar: 'a' }))
  })

  it('sin coincidencias lo indica', async () => {
    vi.mocked(buscarClientes).mockResolvedValue(pagina([]))

    renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    expect(await screen.findByText('Ningún cliente coincide.')).toBeInTheDocument()
  })

  it('pagina la lista de clientes', async () => {
    vi.mocked(buscarClientes).mockResolvedValue(pagina(clientes, { total: 45 }))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    // La búsqueda con espera también corre al montar y, a los 500 ms, vuelve a la página 1.
    // Se espera a que pase para que no deshaga el cambio de página.
    await new Promise((listo) => setTimeout(listo, 600))
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    await waitFor(() => expect(buscarClientes).toHaveBeenLastCalledWith({ buscar: '', pagina: 2, tamano: 20 }))
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(buscarClientes).mockRejectedValueOnce(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    expect(await screen.findByText('No tienes permiso para hacer esto.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
  })
})

describe('Clientes: historial de compras', () => {
  it('al elegir un cliente muestra sus datos y sus pedidos', async () => {
    vi.mocked(pedidosDeCliente).mockResolvedValue(pagina([crearPedido(501), crearPedido(502, { estado: 'rechazado' })]))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    await user.click(await screen.findByRole('button', { name: /Ana Pérez/ }))

    expect(pedidosDeCliente).toHaveBeenCalledWith('c1', { pagina: 1, tamano: 10 })
    expect(screen.getByRole('button', { name: /Ana Pérez/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(screen.getByText('ana@correo.com · 04141234567 · 3 pedidos')).toBeInTheDocument()
    const pedido = await screen.findByRole('button', { name: /Pedido #501/ })
    expect(pedido).toHaveTextContent('1 productos')
    expect(pedido).toHaveTextContent('Entregado')
    expect(pedido).toHaveTextContent('$3.00')
    expect(screen.getByRole('button', { name: /Pedido #502/ })).toHaveTextContent('Rechazado')
  })

  it('un cliente sin pedidos lo indica', async () => {
    vi.mocked(pedidosDeCliente).mockResolvedValue(pagina([]))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    await user.click(await screen.findByRole('button', { name: /Luis Gómez/ }))

    expect(await screen.findByText('Este cliente todavía no tiene pedidos.')).toBeInTheDocument()
    // Sin teléfono, el encabezado del historial no deja un separador vacío.
    expect(screen.getByRole('heading', { name: 'Luis Gómez' }).nextElementSibling).toHaveTextContent(/^luis@correo\.com · 0 pedidos$/)
  })

  it('si falla la carga del historial muestra el error', async () => {
    vi.mocked(pedidosDeCliente).mockRejectedValue(new ErrorApi('No se encontró lo que buscas.', 404, null))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })

    await user.click(await screen.findByRole('button', { name: /Ana Pérez/ }))

    expect(await screen.findByText('No se encontró lo que buscas.')).toBeInTheDocument()
  })

  it('pagina el historial de 10 en 10', async () => {
    const pedidos = Array.from({ length: 10 }, (_, i) => crearPedido(600 + i))
    vi.mocked(pedidosDeCliente).mockResolvedValue(pagina(pedidos, { total: 25 }))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })
    await user.click(await screen.findByRole('button', { name: /Ana Pérez/ }))
    await screen.findByText('Pedido #600')

    await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    await waitFor(() => expect(pedidosDeCliente).toHaveBeenLastCalledWith('c1', { pagina: 2, tamano: 10 }))
  })

  it('al tocar un pedido abre su detalle, sin acciones', async () => {
    vi.mocked(pedidosDeCliente).mockResolvedValue(pagina([crearPedido(501)]))
    const { user } = renderizar(<Clientes />, { ruta: '/panel/clientes', rol: 'ventas' })
    await user.click(await screen.findByRole('button', { name: /Ana Pérez/ }))

    await user.click(await screen.findByRole('button', { name: /Pedido #501/ }))

    const modal = screen.getByRole('dialog')
    expect(within(modal).getByRole('heading', { name: 'Pedido #501' })).toBeInTheDocument()
    expect(within(modal).getByText('REF-501')).toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: /Aprobar|Rechazar|Marcar/ })).not.toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
