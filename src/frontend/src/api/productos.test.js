import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  actualizarProducto,
  borrarProducto,
  crearCategoria,
  crearProducto,
  listarCategorias,
  listarProductos,
  listarTodosLosProductos,
  renombrarCategoria,
} from './productos'

let fetchSimulado

const json = (cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  fetchSimulado = vi.fn().mockImplementation(() => Promise.resolve(json({})))
  vi.stubGlobal('fetch', fetchSimulado)
})

const llamada = (i = 0) => {
  const [url, opciones] = fetchSimulado.mock.calls[i]
  return { url: new URL(url.toString()), metodo: opciones.method, cuerpo: opciones.body && JSON.parse(opciones.body) }
}

describe('productos', () => {
  it('listarProductos usa 50 por página y envía los filtros', async () => {
    await listarProductos({ q: 'leche', incluirInactivos: true })

    expect(llamada().url.pathname).toBe('/productos')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({
      q: 'leche',
      incluirInactivos: 'true',
      pagina: '1',
      tamano: '50',
    })
  })

  it('listarTodosLosProductos recorre las páginas de 100 hasta completar el total', async () => {
    const productos = Array.from({ length: 230 }, (_, i) => ({ id: i }))
    fetchSimulado.mockImplementation((url) => {
      const pagina = Number(new URL(url.toString()).searchParams.get('pagina'))
      return Promise.resolve(json({ items: productos.slice((pagina - 1) * 100, pagina * 100), total: 230 }))
    })

    const todos = await listarTodosLosProductos()

    expect(todos).toHaveLength(230)
    expect(fetchSimulado).toHaveBeenCalledTimes(3)
    expect(llamada(2).url.searchParams.get('pagina')).toBe('3')
    expect(llamada(0).url.searchParams.get('tamano')).toBe('100')
  })

  it('listarTodosLosProductos se detiene si una página llega vacía', async () => {
    fetchSimulado.mockImplementation(() => Promise.resolve(json({ items: [], total: 500 })))

    const todos = await listarTodosLosProductos()

    expect(todos).toEqual([])
    expect(fetchSimulado).toHaveBeenCalledOnce()
  })

  it('crearProducto envía los datos con POST', async () => {
    await crearProducto({ codigoSku: 'VIV-1', nombre: 'Arroz' })

    expect(llamada().url.pathname).toBe('/productos')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { codigoSku: 'VIV-1', nombre: 'Arroz' } })
  })

  it('actualizarProducto envía los datos con PUT', async () => {
    await actualizarProducto('p1', { nombre: 'Arroz integral' })

    expect(llamada().url.pathname).toBe('/productos/p1')
    expect(llamada()).toMatchObject({ metodo: 'PUT', cuerpo: { nombre: 'Arroz integral' } })
  })

  it('borrarProducto hace DELETE', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(borrarProducto('p1')).resolves.toBeNull()

    expect(llamada().url.pathname).toBe('/productos/p1')
    expect(llamada().metodo).toBe('DELETE')
  })

  it('listarCategorias hace GET /categorias', async () => {
    await listarCategorias()

    expect(llamada().url.pathname).toBe('/categorias')
    expect(llamada().metodo).toBe('GET')
  })

  it('crearCategoria y renombrarCategoria envían el nombre', async () => {
    await crearCategoria('Bebidas')
    await renombrarCategoria('c1', 'Bebidas frías')

    expect(llamada(0)).toMatchObject({ metodo: 'POST', cuerpo: { nombre: 'Bebidas' } })
    expect(llamada(0).url.pathname).toBe('/categorias')
    expect(llamada(1)).toMatchObject({ metodo: 'PUT', cuerpo: { nombre: 'Bebidas frías' } })
    expect(llamada(1).url.pathname).toBe('/categorias/c1')
  })
})
