import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarCambios, listarCambiosPedidos, listarPersonalCompleto } from './auditoria'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn()
  vi.stubGlobal('fetch', fetchSimulado)
})

const json = (cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

const llamada = (i = 0) => {
  const [url, opciones] = fetchSimulado.mock.calls[i]
  return { url: new URL(url.toString()), ...opciones }
}

describe('auditoría', () => {
  it('listarCambios aplica los filtros y la paginación por defecto', async () => {
    fetchSimulado.mockResolvedValue(json({ items: [] }))

    await listarCambios({ usuarioId: 'u1', desde: '2026-10-01' })

    const { url, method } = llamada()
    expect(method).toBe('GET')
    expect(url.pathname).toBe('/auditoria')
    expect(Object.fromEntries(url.searchParams)).toEqual({ usuarioId: 'u1', desde: '2026-10-01', pagina: '1', tamano: '25' })
  })

  it('listarCambiosPedidos consulta la auditoría de pedidos', async () => {
    fetchSimulado.mockResolvedValue(json({ items: [] }))

    await listarCambiosPedidos({ hasta: '2026-10-31', pagina: 3 })

    const { url } = llamada()
    expect(url.pathname).toBe('/auditoria/pedidos')
    expect(Object.fromEntries(url.searchParams)).toEqual({ hasta: '2026-10-31', pagina: '3', tamano: '25' })
  })

  it('listarPersonalCompleto pide cada rol del personal y ordena por nombre', async () => {
    const porRol = {
      superadmin: [{ nombre: 'Gerente' }],
      ventas: [{ nombre: 'Álvaro' }, { nombre: 'Zoe' }],
      repartidor: [{ nombre: 'Beatriz' }],
    }
    fetchSimulado.mockImplementation((url) =>
      Promise.resolve(json({ items: porRol[new URL(url.toString()).searchParams.get('rol')] })),
    )

    const personal = await listarPersonalCompleto()

    const roles = fetchSimulado.mock.calls.map(([url]) => new URL(url.toString()).searchParams.get('rol'))
    expect(roles).toEqual(['superadmin', 'ventas', 'repartidor'])
    expect(new URL(fetchSimulado.mock.calls[0][0].toString()).searchParams.get('tamano')).toBe('100')
    expect(personal.map((u) => u.nombre)).toEqual(['Álvaro', 'Beatriz', 'Gerente', 'Zoe'])
  })
})
