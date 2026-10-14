import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarMisEntregas } from './repartidor'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockResolvedValue(new Response('{"items":[],"total":0}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchSimulado)
})

const url = () => new URL(fetchSimulado.mock.calls[0][0].toString())

describe('listarMisEntregas', () => {
  it('pide los pedidos por entregar por defecto', async () => {
    await listarMisEntregas()

    expect(url().pathname).toBe('/repartidor/pedidos')
    expect(Object.fromEntries(url().searchParams)).toEqual({ historial: 'false', pagina: '1', tamano: '20' })
  })

  it('pide el historial cuando se indica', async () => {
    await listarMisEntregas({ historial: true, pagina: 2 })

    expect(url().searchParams.get('historial')).toBe('true')
    expect(url().searchParams.get('pagina')).toBe('2')
  })
})
