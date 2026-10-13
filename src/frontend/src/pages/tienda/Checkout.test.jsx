import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Checkout from './Checkout'
import { renderizar } from '../../test/renderizar'
import { listarZonasEntrega, obtenerDatosPago } from '../../api/catalogo'
import { cotizarPedido, crearPedido } from '../../api/pedidos'
import { ErrorApi } from '../../api/cliente'
import { enviarEventos, registrarEvento } from '../../utils/analitica'

vi.mock('../../api/catalogo', () => ({ listarZonasEntrega: vi.fn(), obtenerDatosPago: vi.fn() }))
vi.mock('../../api/pedidos', () => ({ cotizarPedido: vi.fn(), crearPedido: vi.fn() }))
vi.mock('../../utils/analitica', () => ({ registrarEvento: vi.fn(), enviarEventos: vi.fn() }))

const arroz = { id: 'p1', nombre: 'Arroz', precioUsd: 1.5, precioOriginalUsd: 2, stockDisponible: 10 }
const cafe = { id: 'p2', nombre: 'Café', precioUsd: 5, stockDisponible: 10 }

const linea = (producto, cantidad, extra = {}) => ({
  productoId: producto.id,
  nombre: producto.nombre,
  cantidad,
  stockDisponible: producto.stockDisponible,
  precioUsd: producto.precioUsd,
  precioListaUsd: producto.precioOriginalUsd ?? producto.precioUsd,
  subtotalUsd: producto.precioUsd * cantidad,
  ...extra,
})

const cotizacion = (extra = {}) => ({
  lineas: [linea(arroz, 2), linea(cafe, 1)],
  subtotalUsd: 8,
  descuentoUsd: 0,
  totalUsd: 8,
  tasaBsUsd: 40,
  subtotalBs: 320,
  descuentoBs: 0,
  totalBs: 320,
  cupon: null,
  ...extra,
})

const conCupon = cotizacion({
  descuentoUsd: 0.8,
  totalUsd: 7.2,
  descuentoBs: 32,
  totalBs: 288,
  cupon: { codigo: 'VERANO10', tipo: 'porcentaje', valor: 10 },
})

function guardarCarrito(lineas = [[arroz, 2], [cafe, 1]]) {
  localStorage.setItem(
    'almacen.carrito',
    JSON.stringify(Object.fromEntries(lineas.map(([producto, cantidad]) => [producto.id, { producto, cantidad }]))),
  )
}

const abrir = (opciones = { rol: 'cliente' }) => renderizar(<Checkout />, { ruta: '/checkout', ...opciones })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarZonasEntrega).mockResolvedValue([
    { id: 'z1', nombre: 'Centro' },
    { id: 'z2', nombre: 'Barrio Obrero' },
  ])
  vi.mocked(obtenerDatosPago).mockResolvedValue({
    tasaBsUsd: 40,
    datosPagoMovil: 'Banco de Venezuela · 0414-0000000 · V-12345678',
    datosTransferencia: 'Cuenta 0102-0000-00-0000000000',
    walletBinance: 'binance-pay-123',
    numeroSoporte: '+584140000000',
  })
  vi.mocked(cotizarPedido).mockResolvedValue(cotizacion())
})

describe('Checkout: acceso', () => {
  it('con el carrito vacío invita a ver el catálogo', () => {
    abrir()

    expect(screen.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/')
  })

  it('sin sesión pide entrar con Google y conserva el carrito', () => {
    guardarCarrito()
    abrir({})

    expect(screen.getByRole('heading', { name: 'Ingresa para terminar tu compra' })).toBeInTheDocument()
    expect(cotizarPedido).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(2)
  })

  it('el personal no puede comprar', () => {
    guardarCarrito()
    abrir({ rol: 'ventas' })

    expect(screen.getByRole('heading', { name: 'Las compras son para clientes' })).toBeInTheDocument()
  })
})

describe('Checkout: resumen y cupón', () => {
  it('cotiza el carrito con la API y muestra el total en USD y Bs', async () => {
    guardarCarrito()
    abrir()

    const resumen = await screen.findByRole('complementary')
    expect(await within(resumen).findByText('2 × Arroz')).toBeInTheDocument()
    expect(within(resumen).getByText('oferta')).toBeInTheDocument()
    expect(within(resumen).getAllByText('$8.00')).toHaveLength(2) // subtotal y total
    expect(within(resumen).getByText('Bs 320,00')).toBeInTheDocument()
    expect(cotizarPedido).toHaveBeenCalledWith({
      items: [
        { productoId: 'p1', cantidad: 2 },
        { productoId: 'p2', cantidad: 1 },
      ],
      codigoCupon: null,
    })
  })

  it('aplicar un cupón válido muestra el descuento y el nuevo total', async () => {
    guardarCarrito()
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    vi.mocked(cotizarPedido).mockResolvedValue(conCupon)

    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'verano10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByText('VERANO10')).toBeInTheDocument()
    expect(screen.getByText('−$0.80')).toBeInTheDocument()
    expect(screen.getByText('$7.20')).toBeInTheDocument()
    expect(cotizarPedido).toHaveBeenCalledWith(expect.objectContaining({ codigoCupon: 'verano10' }))
  })

  it('un cupón inválido muestra el motivo de la API y no cambia el total', async () => {
    guardarCarrito()
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    vi.mocked(cotizarPedido).mockRejectedValueOnce(new ErrorApi('El cupón ya venció.', 400, null))

    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'VIEJO')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByText('El cupón ya venció.')).toBeInTheDocument()
    expect(screen.queryByText('Descuento')).not.toBeInTheDocument()
  })

  it('quitar el cupón vuelve a cotizar sin él', async () => {
    guardarCarrito()
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    vi.mocked(cotizarPedido).mockResolvedValue(conCupon)
    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'VERANO10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await screen.findByText('−$0.80')

    vi.mocked(cotizarPedido).mockResolvedValue(cotizacion())
    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(() => expect(screen.queryByText('−$0.80')).not.toBeInTheDocument())
    expect(screen.getByLabelText('¿Tienes un cupón?')).toHaveValue('')
  })

  it('avisa si un producto ya no tiene stock suficiente y permite ajustar el carrito', async () => {
    guardarCarrito()
    vi.mocked(cotizarPedido).mockResolvedValue(cotizacion({ lineas: [linea(arroz, 2, { stockDisponible: 1 }), linea(cafe, 1)] }))
    const { user } = abrir()

    expect(await screen.findByText('Arroz: quedan 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ajustar mi carrito' }))

    await waitFor(() => expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(1))
  })

  it('sin tasa del día no deja confirmar', async () => {
    guardarCarrito()
    vi.mocked(cotizarPedido).mockResolvedValue(cotizacion({ tasaBsUsd: null, subtotalBs: null, descuentoBs: null, totalBs: null }))
    abrir()

    expect(await screen.findByText(/todavía no cargó la tasa del día/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
  })
})

describe('Checkout: pago y envío', () => {
  async function llenarFormulario(user) {
    await screen.findByRole('option', { name: 'Centro' })
    await user.selectOptions(screen.getByLabelText('Zona'), 'z1')
    await user.type(screen.getByLabelText('Teléfono de contacto'), '0414 123 4567')
    await user.type(screen.getByLabelText('Dirección y punto de referencia'), 'Calle 10, portón azul')
    await user.type(screen.getByLabelText('Referencia del pago'), '987654')
    await user.upload(screen.getByLabelText('Captura del comprobante'), new File(['img'], 'pago.png', { type: 'image/png' }))
  }

  it('muestra los datos del método elegido y el monto en Bs o en USDT', async () => {
    guardarCarrito()
    const { user } = abrir()

    expect(await screen.findByText(/Banco de Venezuela/)).toBeInTheDocument()
    expect(await screen.findByText('Bs 320,00', { selector: 'strong' })).toBeInTheDocument()

    await user.click(screen.getByLabelText('Binance (USDT)'))

    expect(screen.getByText('binance-pay-123')).toBeInTheDocument()
    expect(screen.getByText('8.00 USDT')).toBeInTheDocument()
  })

  it('no envía si faltan datos y marca cada campo', async () => {
    guardarCarrito()
    const { user } = abrir()
    await screen.findByText('2 × Arroz')

    await user.type(screen.getByLabelText('Teléfono de contacto'), '0212 555 1234')
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(screen.getByText('Elige tu zona.')).toBeInTheDocument()
    expect(screen.getByText('Debe ser un celular venezolano: 04XX XXX XXXX.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la referencia del pago.')).toBeInTheDocument()
    expect(screen.getByText('Adjunta la captura del pago.')).toBeInTheDocument()
    expect(crearPedido).not.toHaveBeenCalled()
  })

  it('confirma el pedido con el cupón aplicado, vacía el carrito y va a "Mis pedidos"', async () => {
    guardarCarrito()
    vi.mocked(crearPedido).mockResolvedValue({ id: 'n1', numero: 42 })
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    vi.mocked(cotizarPedido).mockResolvedValue(conCupon)
    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'verano10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await screen.findByText('−$0.80')
    await llenarFormulario(user)

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/mis-pedidos')
    expect(crearPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { productoId: 'p1', cantidad: 2 },
          { productoId: 'p2', cantidad: 1 },
        ],
        zonaId: 'z1',
        telefono: '0414 123 4567',
        direccionTexto: 'Calle 10, portón azul',
        metodoPago: 'pago_movil',
        referenciaPago: '987654',
        codigoCupon: 'VERANO10',
        captura: expect.any(File),
      }),
    )
    expect(JSON.parse(localStorage.getItem('almacen.carrito'))).toEqual({})
  })

  it('si la API rechaza por stock muestra el mensaje y vuelve a cotizar', async () => {
    guardarCarrito()
    vi.mocked(crearPedido).mockRejectedValue(new ErrorApi('No hay suficiente stock de "Arroz".', 409, { mensaje: 'x' }))
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    await llenarFormulario(user)
    const cotizacionesAntes = vi.mocked(cotizarPedido).mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay suficiente stock de "Arroz".')
    await waitFor(() => expect(vi.mocked(cotizarPedido).mock.calls.length).toBeGreaterThan(cotizacionesAntes))
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(2)
  })
})

describe('Checkout: analítica', () => {
  const eventos = () => vi.mocked(registrarEvento).mock.calls.map(([tipo, datos]) => (datos ? [tipo, datos] : [tipo]))

  it('registra el inicio del pago y los cupones aplicados y rechazados', async () => {
    guardarCarrito()
    const { user } = abrir()
    await screen.findByText('2 × Arroz')
    expect(eventos()).toContainEqual(['inicio_checkout'])

    vi.mocked(cotizarPedido).mockRejectedValueOnce(new ErrorApi('El cupón no existe.', 400, null))
    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'falso')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await screen.findByText('El cupón no existe.')

    vi.mocked(cotizarPedido).mockResolvedValue(conCupon)
    await user.clear(screen.getByLabelText('¿Tienes un cupón?'))
    await user.type(screen.getByLabelText('¿Tienes un cupón?'), 'verano10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await screen.findByText('−$0.80')

    expect(eventos()).toContainEqual(['cupon_rechazado', { texto: 'falso' }])
    expect(eventos()).toContainEqual(['cupon_aplicado', { texto: 'verano10' }])
  })

  it('al confirmar registra el pedido con su total y envía los eventos enseguida', async () => {
    guardarCarrito()
    vi.mocked(crearPedido).mockResolvedValue({ id: 'n1', numero: 42, totalUsd: 8 })
    const { user } = abrir()
    await screen.findByRole('option', { name: 'Centro' })
    await user.selectOptions(screen.getByLabelText('Zona'), 'z1')
    await user.type(screen.getByLabelText('Teléfono de contacto'), '0414 123 4567')
    await user.type(screen.getByLabelText('Dirección y punto de referencia'), 'Calle 10, portón azul')
    await user.type(screen.getByLabelText('Referencia del pago'), '987654')
    await user.upload(screen.getByLabelText('Captura del comprobante'), new File(['img'], 'pago.png', { type: 'image/png' }))

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))

    await screen.findByTestId('ubicacion')
    expect(eventos()).toContainEqual(['pedido_confirmado', { valor: 8 }])
    expect(enviarEventos).toHaveBeenCalled()
  })
})
