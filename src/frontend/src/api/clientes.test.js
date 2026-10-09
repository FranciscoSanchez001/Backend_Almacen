import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buscarClientes, pedidosDeCliente } from './clientes'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response('{"items":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  vi.stubGlobal('fetch', fetchSimulado)
})

const url = () => new URL(fetchSimulado.mock.calls[0][0].toString())

describe('clientes', () => {
  it('buscarClientes envía el texto de búsqueda con 20 resultados por página', async () => {
    await buscarClientes({ buscar: 'maría' })

    expect(url().pathname).toBe('/clientes')
    expect(Object.fromEntries(url().searchParams)).toEqual({ buscar: 'maría', pagina: '1', tamano: '20' })
  })

  it('buscarClientes sin texto omite el filtro', async () => {
    await buscarClientes()

    expect(url().searchParams.has('buscar')).toBe(false)
  })

  it('pedidosDeCliente consulta el historial del cliente', async () => {
    await pedidosDeCliente('c42', { pagina: 2 })

    expect(url().pathname).toBe('/clientes/c42/pedidos')
    expect(Object.fromEntries(url().searchParams)).toEqual({ pagina: '2', tamano: '10' })
  })
})
