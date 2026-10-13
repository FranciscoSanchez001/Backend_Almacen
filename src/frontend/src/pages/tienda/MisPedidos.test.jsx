import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MisPedidos from './MisPedidos'
import { renderizar, pagina } from '../../test/renderizar'
import { listarMisPedidos } from '../../api/pedidos'
import { AuthProvider } from '../../context/AuthContext'
import { CarritoProvider } from '../../context/CarritoContext'
import { ThemeProvider } from '../../context/ThemeContext'
import { guardarToken } from '../../api/cliente'
import { crearToken } from '../../test/jwt'

vi.mock('../../api/pedidos', () => ({ listarMisPedidos: vi.fn() }))

const pedido = (numero, estado, extra = {}) => ({
  id: `id-${numero}`,
  numero,
  estado,
  creadoEn: '2026-10-13T15:00:00Z',
  expiraEn: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  totalUsd: 7.2,
  totalBs: 288,
  subtotalUsd: 8,
  descuentoUsd: 0.8,
  codigoCupon: 'VERANO10',
  tasaCambio: 40,
  monedaPago: 'VES',
  metodoPago: 'pago_movil',
  referenciaPago: '987654',
  capturaUrl: null,
  zona: { id: 'z1', nombre: 'Centro' },
  direccionTexto: 'Calle 10',
  telefonoContacto: '+584141234567',
  cliente: { nombre: 'Ana' },
  items: [
    { productoId: 'p1', producto: 'Arroz', categoria: 'Víveres', cantidad: 2, precioUsd: 1.5, precioListaUsd: 2, subtotalUsd: 3 },
    { productoId: 'p2', producto: 'Café', categoria: 'Víveres', cantidad: 1, precioUsd: 5, precioListaUsd: 5, subtotalUsd: 5 },
  ],
  historial: [],
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarMisPedidos).mockResolvedValue(pagina([pedido(42, 'pendiente'), pedido(41, 'entregado')]))
})

describe('MisPedidos', () => {
  it('sin sesión de cliente pide entrar con Google', () => {
    vi.stubGlobal('google', { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } })
    renderizar(<MisPedidos />, { ruta: '/mis-pedidos' })

    expect(screen.getByText('Ingresa con tu cuenta de Google para ver tus pedidos.')).toBeInTheDocument()
    expect(listarMisPedidos).not.toHaveBeenCalled()
  })

  it('lista los pedidos con su estado, lo que significa y el total', async () => {
    renderizar(<MisPedidos />, { ruta: '/mis-pedidos', rol: 'cliente' })

    const pendiente = (await screen.findByText('Pedido #42')).closest('li')
    expect(within(pendiente).getByText('Pendiente')).toBeInTheDocument()
    expect(within(pendiente).getByText('Estamos verificando tu pago.')).toBeInTheDocument()
    expect(within(pendiente).getByText(/Vence en/)).toBeInTheDocument()
    expect(within(pendiente).getByText('$7.20')).toBeInTheDocument()
    expect(within(pendiente).getByText(/3 productos/)).toBeInTheDocument()

    const entregado = screen.getByText('Pedido #41').closest('li')
    expect(within(entregado).getByText('Pedido entregado.')).toBeInTheDocument()
    expect(within(entregado).queryByText(/Vence en/)).not.toBeInTheDocument()
  })

  it('el detalle muestra el cupón, el descuento y el precio de lista tachado', async () => {
    const { user } = renderizar(<MisPedidos />, { ruta: '/mis-pedidos', rol: 'cliente' })

    const fila = (await screen.findByText('Pedido #42')).closest('li')
    await user.click(within(fila).getByRole('button', { name: 'Ver detalle' }))

    const detalle = screen.getByRole('dialog', { name: 'Pedido #42' })
    expect(within(detalle).getByText('VERANO10')).toBeInTheDocument()
    expect(within(detalle).getByText(/−\$0\.80/)).toBeInTheDocument()
    expect(within(detalle).getByText('$2.00')).toHaveClass('line-through')
  })

  it('sin pedidos lo dice', async () => {
    vi.mocked(listarMisPedidos).mockResolvedValue(pagina([]))
    renderizar(<MisPedidos />, { ruta: '/mis-pedidos', rol: 'cliente' })

    expect(await screen.findByText('Todavía no has hecho pedidos.')).toBeInTheDocument()
  })

  it('al llegar desde el checkout confirma el pedido recién hecho', async () => {
    guardarToken(crearToken({ rol: 'cliente' }))
    render(
      <ThemeProvider>
        <AuthProvider>
          <CarritoProvider>
            <MemoryRouter initialEntries={[{ pathname: '/mis-pedidos', state: { nuevo: 42 } }]}>
              <Routes>
                <Route path="/mis-pedidos" element={<MisPedidos />} />
              </Routes>
            </MemoryRouter>
          </CarritoProvider>
        </AuthProvider>
      </ThemeProvider>,
    )

    expect(await screen.findByText('¡Recibimos tu pedido #42!')).toBeInTheDocument()
  })
})
