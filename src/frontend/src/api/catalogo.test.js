import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarCatalogo, listarCategorias, listarZonasEntrega, obtenerDatosPago } from './catalogo'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  vi.stubGlobal('fetch', fetchSimulado)
})

const url = () => new URL(fetchSimulado.mock.calls[0][0].toString())

describe('catálogo público', () => {
  it('listarCatalogo usa 24 productos por página por defecto', async () => {
    await listarCatalogo()

    expect(url().pathname).toBe('/catalogo')
    expect(Object.fromEntries(url().searchParams)).toEqual({ pagina: '1', tamano: '24' })
  })

  it('listarCatalogo envía la búsqueda y la categoría', async () => {
    await listarCatalogo({ q: 'arroz', categoriaId: 'c1', pagina: 2 })

    expect(Object.fromEntries(url().searchParams)).toEqual({ q: 'arroz', categoriaId: 'c1', pagina: '2', tamano: '24' })
  })

  it('listarCategorias consulta las categorías sin sesión', async () => {
    await listarCategorias()

    expect(url().pathname).toBe('/categorias')
    expect(fetchSimulado.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})

describe('catálogo: ofertas y checkout', () => {
  it('listarCatalogo con ofertas pide solo los productos en oferta', async () => {
    await listarCatalogo({ ofertas: true })

    expect(Object.fromEntries(url().searchParams)).toEqual({ ofertas: 'true', pagina: '1', tamano: '24' })
  })

  it('listarZonasEntrega y obtenerDatosPago consultan las rutas del checkout', async () => {
    await listarZonasEntrega()
    await obtenerDatosPago()

    const rutas = fetchSimulado.mock.calls.map(([u]) => new URL(u.toString()).pathname)
    expect(rutas).toEqual(['/catalogo/zonas', '/catalogo/pago'])
  })
})
