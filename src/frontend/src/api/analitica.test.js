import { beforeEach, describe, expect, it, vi } from 'vitest'
import { obtenerComportamiento } from './analitica'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchSimulado)
})

describe('analítica (panel)', () => {
  it('obtenerComportamiento consulta el período elegido', async () => {
    await obtenerComportamiento({ tipo: 'personalizado', desde: '2026-10-01', hasta: '2026-10-13' })

    const url = new URL(fetchSimulado.mock.calls[0][0].toString())
    expect(url.pathname).toBe('/analitica/comportamiento')
    expect(Object.fromEntries(url.searchParams)).toEqual({ tipo: 'personalizado', desde: '2026-10-01', hasta: '2026-10-13' })
  })
})
