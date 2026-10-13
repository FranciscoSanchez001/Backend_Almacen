import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actualizarCupon, crearCupon, listarCupones } from './cupones'

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

describe('cupones', () => {
  it('listarCupones filtra por texto y estado', async () => {
    await listarCupones({ q: 'verano', activo: true })

    expect(llamada().url.pathname).toBe('/cupones')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ q: 'verano', activo: 'true', pagina: '1', tamano: '50' })
  })

  it('crearCupon hace POST con los datos', async () => {
    await crearCupon({ codigo: 'VERANO10', tipo: 'porcentaje', valor: 10 })

    expect(llamada().url.pathname).toBe('/cupones')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { codigo: 'VERANO10', tipo: 'porcentaje', valor: 10 } })
  })

  it('actualizarCupon hace PUT al cupón', async () => {
    await actualizarCupon('c1', { tipo: 'monto_fijo', valor: 5, activo: false })

    expect(llamada().url.pathname).toBe('/cupones/c1')
    expect(llamada()).toMatchObject({ metodo: 'PUT', cuerpo: { tipo: 'monto_fijo', valor: 5, activo: false } })
  })
})
