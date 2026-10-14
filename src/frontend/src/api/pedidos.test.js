import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aprobarPedido, crearPedido, listarMisPedidos, listarPedidos, listarRepartidores, marcarEnCamino, marcarEntregado, rechazarPedido } from './pedidos'

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
  it('envía el checkout como multipart con ítems indexados y comprobante', async () => {
    const captura = new File(['imagen'], 'pago.png', { type: 'image/png' })
    await crearPedido({ lineas: [{ producto: { id: 'p1' }, cantidad: 2 }, { producto: { id: 'p2' }, cantidad: 3 }],
      metodoPago: 'pago_movil', referenciaPago: ' REF-123 ', zonaId: 'z1', direccionTexto: ' Casa azul ', telefono: '+584121234567', captura })
    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(url.pathname).toBe('/pedidos')
    expect(opciones.method).toBe('POST')
    expect(opciones.headers['Content-Type']).toBeUndefined()
    expect(opciones.body).toBeInstanceOf(FormData)
    expect(opciones.body.get('items[0].productoId')).toBe('p1')
    expect(opciones.body.get('items[0].cantidad')).toBe('2')
    expect(opciones.body.get('items[1].productoId')).toBe('p2')
    expect(opciones.body.get('items[1].cantidad')).toBe('3')
    expect(opciones.body.get('metodoPago')).toBe('pago_movil')
    expect(opciones.body.get('referenciaPago')).toBe('REF-123')
    expect(opciones.body.get('direccionTexto')).toBe('Casa azul')
    expect(opciones.body.get('zonaId')).toBe('z1')
    expect(opciones.body.get('telefono')).toBe('+584121234567')
    expect(opciones.body.get('captura').name).toBe('pago.png')
  })

  it('consulta los pedidos del cliente con paginación', async () => {
    await listarMisPedidos({ pagina: 2 })
    expect(llamada().url.pathname).toBe('/pedidos/mios')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ pagina: '2', tamano: '20' })
  })
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
