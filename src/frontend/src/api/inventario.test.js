import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarInventario, listarMovimientos, reponer } from './inventario'

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

describe('inventario', () => {
  it('listarInventario envía solo los filtros indicados', async () => {
    await listarInventario({ q: 'harina', soloAgotados: true })

    expect(llamada().url.pathname).toBe('/inventario')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ q: 'harina', soloAgotados: 'true' })
  })

  it('listarInventario sin filtros no agrega parámetros', async () => {
    await listarInventario()

    expect(llamada().url.search).toBe('')
  })

  it('reponer suma stock con POST', async () => {
    await reponer('p1', 20)

    expect(llamada().url.pathname).toBe('/inventario/p1/reponer')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { cantidad: 20 } })
  })

  it('listarMovimientos pagina de 20 en 20 por defecto', async () => {
    await listarMovimientos('p1')

    expect(llamada().url.pathname).toBe('/inventario/p1/movimientos')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ pagina: '1', tamano: '20' })
  })
})
