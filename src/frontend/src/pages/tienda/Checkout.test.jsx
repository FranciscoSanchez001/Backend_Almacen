import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Checkout from './Checkout'
import { renderizar } from '../../test/renderizar'
import { obtenerDatosPago, listarZonasEntrega, obtenerProductoCatalogo } from '../../api/catalogo'
import { crearPedido } from '../../api/pedidos'
import { ErrorApi } from '../../api/cliente'
import { useCarrito } from '../../context/CarritoContext'

vi.mock('../../api/catalogo', () => ({ obtenerDatosPago: vi.fn(), listarZonasEntrega: vi.fn(), obtenerProductoCatalogo: vi.fn() }))
vi.mock('../../api/pedidos', () => ({ crearPedido: vi.fn() }))

const producto = { id: 'p1', nombre: 'Arroz', precioUsd: 2, precioBs: 99, stockDisponible: 5 }
const pago = { tasaBsUsd: 50, datosTransferencia: 'Banco de prueba, cuenta 123', datosPagoMovil: 'Banco, teléfono 04121234567', walletBinance: 'wallet-pruebas' }
const montar = (rol = 'cliente') => renderizar(<Checkout />, { ruta: '/checkout', rol })
beforeEach(() => {
  vi.mocked(obtenerDatosPago).mockReset().mockResolvedValue(pago)
  vi.mocked(listarZonasEntrega).mockReset().mockResolvedValue([{ id: 'z1', nombre: 'Centro' }])
  vi.mocked(obtenerProductoCatalogo).mockReset().mockResolvedValue(producto)
  vi.mocked(crearPedido).mockReset().mockResolvedValue({ numero: 123, totalUsd: 4, totalBs: 200 })
  localStorage.setItem('almacen.carrito', JSON.stringify({ p1: { producto: { ...producto, precioUsd: 1 }, cantidad: 2 } }))
})

async function completar(user) {
  await user.selectOptions(await screen.findByLabelText('Zona de entrega'), 'z1')
  await user.type(screen.getByLabelText('Dirección y referencia'), 'Casa azul, calle principal')
  await user.type(screen.getByLabelText('Teléfono de contacto'), '0412 123 4567')
  await user.selectOptions(screen.getByLabelText('Método de pago'), 'pago_movil')
  await user.type(screen.getByLabelText('Referencia del pago'), 'REF-123')
  await user.upload(screen.getByLabelText('Comprobante de pago'), new File(['imagen'], 'pago.png', { type: 'image/png' }))
}

describe('Checkout', () => {
  it('pide acceso de cliente sin consultar datos bancarios al visitante', () => {
    montar(null)
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeInTheDocument()
    expect(obtenerDatosPago).not.toHaveBeenCalled()
  })

  it('bloquea compras desde una cuenta del personal', () => {
    montar('superadmin')
    expect(screen.getByText(/Cierra la sesión del personal/)).toBeInTheDocument()
    expect(obtenerDatosPago).not.toHaveBeenCalled()
  })

  it('muestra el carrito vacío sin cargar datos de pago', () => {
    localStorage.removeItem('almacen.carrito')
    montar()
    expect(screen.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument()
    expect(obtenerDatosPago).not.toHaveBeenCalled()
  })

  it('usa precios actuales y muestra el monto en Bs o USDT según el método', async () => {
    const { user } = montar()
    await screen.findByLabelText('Método de pago')
    expect(screen.getByText('Total: $4.00')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'transferencia')
    expect(screen.getByText('Monto a pagar: Bs 200,00')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'binance')
    expect(screen.getByText('Monto a pagar: 4.00 USDT')).toBeInTheDocument()
    expect(screen.getByText('wallet-pruebas')).toBeInTheDocument()
  })

  it('confirma una sola vez y vacía el carrito únicamente después de recibir el pedido', async () => {
    let resolver
    vi.mocked(crearPedido).mockReturnValue(new Promise(resolve => { resolver = resolve }))
    const { user } = montar()
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    fireEvent.submit(screen.getByLabelText('Teléfono de contacto').closest('form'))
    expect(crearPedido).toHaveBeenCalledOnce()
    expect(crearPedido).toHaveBeenCalledWith(expect.objectContaining({ metodoPago: 'pago_movil', zonaId: 'z1', telefono: '+584121234567', referenciaPago: 'REF-123', captura: expect.any(File) }))
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(2)
    expect(screen.getByRole('button', { name: 'Registrando pedido…' })).toBeDisabled()
    await act(async () => resolver({ numero: 123, totalUsd: 4, totalBs: 200 }))
    expect(await screen.findByRole('heading', { name: 'Pedido #123 recibido' })).toBeInTheDocument()
    expect(localStorage.getItem('almacen.carrito')).toBe('{}')
    expect(screen.getByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute('href', '/mis-pedidos')
  })

  it('con un rechazo de stock conserva productos y datos del formulario', async () => {
    vi.mocked(crearPedido).mockRejectedValue(new ErrorApi('No hay suficiente stock.', 409))
    const { user } = montar()
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay suficiente stock.')
    expect(screen.getByLabelText('Referencia del pago')).toHaveValue('REF-123')
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(2)
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
  })

  it('conserva unidades añadidas mientras se envía el pedido', async () => {
    let resolver
    vi.mocked(crearPedido).mockReturnValue(new Promise(resolve => { resolver = resolve }))
    function AgregarDuranteEnvio() {
      const { cambiarCantidad } = useCarrito()
      return <button type="button" onClick={() => cambiarCantidad(producto, 3)}>Agregar mientras se envía</button>
    }
    const { user } = renderizar(<><Checkout /><AgregarDuranteEnvio /></>, { ruta: '/checkout', rol: 'cliente' })
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    await user.click(screen.getByRole('button', { name: 'Agregar mientras se envía' }))
    await act(async () => resolver({ numero: 123, totalUsd: 4, totalBs: 200 }))
    expect(await screen.findByRole('heading', { name: 'Pedido #123 recibido' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(1)
  })

  it('si se pierde la respuesta dirige a revisar pedidos antes de repetir', async () => {
    vi.mocked(crearPedido).mockRejectedValue(new ErrorApi('No se pudo conectar.', 0))
    const { user } = montar()
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('link', { name: /Revisa tus pedidos/ })).toHaveAttribute('href', '/mis-pedidos')
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
    expect(localStorage.getItem('almacen.carrito')).not.toBe('{}')
  })

  it('detecta productos con stock insuficiente antes de mostrar las instrucciones de pago', async () => {
    vi.mocked(obtenerProductoCatalogo).mockResolvedValue({ ...producto, stockDisponible: 1 })
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 1 unidades de Arroz')
    expect(screen.queryByLabelText('Método de pago')).not.toBeInTheDocument()
  })

  it('oculta métodos que no tienen datos configurados', async () => {
    vi.mocked(obtenerDatosPago).mockResolvedValue({ ...pago, datosPagoMovil: '', walletBinance: null })
    montar()
    await screen.findByLabelText('Método de pago')
    expect(screen.queryByRole('option', { name: 'Binance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pago móvil' })).not.toBeInTheDocument()
  })

  it('permite reintentar cuando no se cargan los datos del checkout', async () => {
    vi.mocked(obtenerDatosPago).mockRejectedValueOnce(new Error('Sin conexión'))
    const { user } = montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Zona de entrega')).toBeInTheDocument()
  })

  it('rechaza un teléfono inválido antes de crear el pedido', async () => {
    const { user } = montar()
    await completar(user)
    fireEvent.change(screen.getByLabelText('Teléfono de contacto'), { target: { value: '123' } })
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('celular venezolano válido')
    expect(crearPedido).not.toHaveBeenCalled()
  })

  it('rechaza un comprobante con formato inválido', async () => {
    const { user } = montar()
    await completar(user)
    fireEvent.change(screen.getByLabelText('Comprobante de pago'), { target: { files: [new File(['pdf'], 'pago.pdf', { type: 'application/pdf' })] } })
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG o WEBP'))
    expect(crearPedido).not.toHaveBeenCalled()
  })
})
