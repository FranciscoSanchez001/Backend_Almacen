import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aprobarPedido,
  cotizarPedido,
  crearPedido,
  listarMisPedidos,
  listarPedidos,
  listarRepartidores,
  marcarEnCamino,
  marcarEntregado,
  obtenerPedido,
  rechazarPedido,
} from './pedidos'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  vi.stubGlobal('fetch', fetchSimulado)
})

const llamada = () => {
  const [url, opciones] = fetchSimulado.mock.calls[0]
  return { url: new URL(url.toString()), metodo: opciones.method, cuerpo: opciones.body && JSON.parse(opciones.body) }
}

describe('pedidos', () => {
  it('listarPedidos filtra por estado y zona con 20 por página', async () => {
    await listarPedidos({ estado: 'pendiente', zonaId: 'z1' })

    expect(llamada().url.pathname).toBe('/pedidos')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ estado: 'pendiente', zonaId: 'z1', pagina: '1', tamano: '20' })
  })

  it('listarRepartidores hace GET /pedidos/repartidores', async () => {
    await listarRepartidores()

    expect(llamada().url.pathname).toBe('/pedidos/repartidores')
    expect(llamada().metodo).toBe('GET')
  })

  it('aprobarPedido envía el repartidor asignado', async () => {
    await aprobarPedido('p1', 'r7')

    expect(llamada().url.pathname).toBe('/pedidos/p1/aprobar')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { repartidorId: 'r7' } })
  })

  it('rechazarPedido envía el motivo sin espacios sobrantes', async () => {
    await rechazarPedido('p1', '  Captura ilegible  ')

    expect(llamada().url.pathname).toBe('/pedidos/p1/rechazar')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { motivo: 'Captura ilegible' } })
  })

  it.each([undefined, '', '   '])('rechazarPedido sin motivo (%j) envía null para usar el de la API', async (motivo) => {
    await rechazarPedido('p1', motivo)

    expect(llamada().cuerpo).toEqual({ motivo: null })
  })

  it('marcarEnCamino y marcarEntregado cambian el estado con POST', async () => {
    await marcarEnCamino('p1')
    await marcarEntregado('p1')

    const rutas = fetchSimulado.mock.calls.map(([url, opciones]) => `${opciones.method} ${new URL(url.toString()).pathname}`)
    expect(rutas).toEqual(['POST /pedidos/p1/en-camino', 'POST /pedidos/p1/entregado'])
  })
})

describe('pedidos del cliente', () => {
  const items = [
    { productoId: 'p1', cantidad: 2 },
    { productoId: 'p2', cantidad: 1 },
  ]
  const captura = () => new File(['x'], 'pago.png', { type: 'image/png' })

  it('cotizarPedido envía los ítems y el cupón sin espacios', async () => {
    await cotizarPedido({ items, codigoCupon: '  verano10 ' })

    expect(llamada().url.pathname).toBe('/pedidos/cotizar')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { items, codigoCupon: 'verano10' } })
  })

  it.each([undefined, null, '  '])('cotizarPedido sin cupón (%j) envía null', async (codigoCupon) => {
    await cotizarPedido({ items, codigoCupon })

    expect(llamada().cuerpo.codigoCupon).toBeNull()
  })

  it('crearPedido arma el multipart con ítems indexados, cupón, ubicación y captura', async () => {
    await crearPedido({
      items,
      metodoPago: 'pago_movil',
      referenciaPago: ' 123456 ',
      zonaId: 'z1',
      direccionTexto: ' Calle 1, casa azul ',
      telefono: '0414 123 4567',
      latitud: 7.76,
      longitud: -72.22,
      codigoCupon: 'VERANO10',
      captura: captura(),
    })

    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(new URL(url.toString()).pathname).toBe('/pedidos')
    expect(opciones.method).toBe('POST')
    const datos = opciones.body
    expect(datos).toBeInstanceOf(FormData)
    expect(Object.fromEntries([...datos.entries()].filter(([, v]) => typeof v === 'string'))).toEqual({
      'items[0].productoId': 'p1',
      'items[0].cantidad': '2',
      'items[1].productoId': 'p2',
      'items[1].cantidad': '1',
      metodoPago: 'pago_movil',
      referenciaPago: '123456',
      zonaId: 'z1',
      direccionTexto: 'Calle 1, casa azul',
      telefono: '0414 123 4567',
      latitud: '7.76',
      longitud: '-72.22',
      codigoCupon: 'VERANO10',
    })
    expect(datos.get('captura').name).toBe('pago.png')
  })

  it('crearPedido sin ubicación ni cupón no los envía', async () => {
    await crearPedido({
      items,
      metodoPago: 'binance',
      referenciaPago: 'abc',
      zonaId: 'z1',
      direccionTexto: 'Calle 1',
      telefono: '04141234567',
      captura: captura(),
    })

    const datos = fetchSimulado.mock.calls[0][1].body
    expect(datos.has('latitud')).toBe(false)
    expect(datos.has('codigoCupon')).toBe(false)
  })

  it('listarMisPedidos y obtenerPedido consultan los pedidos del cliente', async () => {
    await listarMisPedidos({ pagina: 2 })
    await obtenerPedido('p9')

    const urls = fetchSimulado.mock.calls.map(([u]) => new URL(u.toString()))
    expect(urls[0].pathname).toBe('/pedidos/mios')
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({ pagina: '2', tamano: '10' })
    expect(urls[1].pathname).toBe('/pedidos/p9')
  })
})
