import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aprobarPedido, listarPedidos, listarRepartidores, marcarEnCamino, marcarEntregado, rechazarPedido } from './pedidos'

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
