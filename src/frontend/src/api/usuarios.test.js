import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES_PERSONAL, actualizarUsuario, cambiarActivo, crearUsuario, listarPersonal } from './usuarios'

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

function responderPorRol(porRol) {
  fetchSimulado.mockImplementation((url) =>
    Promise.resolve(json(porRol[new URL(url.toString()).searchParams.get('rol')])),
  )
}

describe('listarPersonal', () => {
  it('pide ventas y repartidores por separado y los ordena por nombre', async () => {
    responderPorRol({
      ventas: { items: [{ nombre: 'Zoe' }, { nombre: 'Ángel' }], total: 2 },
      repartidor: { items: [{ nombre: 'Carlos' }], total: 1 },
    })

    const { usuarios, incompleto } = await listarPersonal()

    expect(ROLES_PERSONAL).toEqual(['ventas', 'repartidor'])
    expect(fetchSimulado.mock.calls.map(([u]) => new URL(u.toString()).searchParams.get('rol'))).toEqual(['ventas', 'repartidor'])
    expect(llamada().url.searchParams.get('tamano')).toBe('100')
    expect(usuarios.map((u) => u.nombre)).toEqual(['Ángel', 'Carlos', 'Zoe'])
    expect(incompleto).toBe(false)
  })

  it('indica que la lista está incompleta si algún rol tiene más de 100 usuarios', async () => {
    responderPorRol({
      ventas: { items: [{ nombre: 'Ana' }], total: 150 },
      repartidor: { items: [], total: 0 },
    })

    const { incompleto } = await listarPersonal()

    expect(incompleto).toBe(true)
  })
})

describe('crear y actualizar usuarios', () => {
  it('crearUsuario envía el teléfono vacío como null', async () => {
    await crearUsuario({ nombre: 'Ana', email: 'ana@almacen.local', telefono: '', rol: 'ventas', password: 'Clave123!' })

    expect(llamada().url.pathname).toBe('/usuarios')
    expect(llamada()).toMatchObject({
      metodo: 'POST',
      cuerpo: { nombre: 'Ana', email: 'ana@almacen.local', telefono: null, rol: 'ventas', password: 'Clave123!' },
    })
  })

  it('actualizarUsuario con contraseña vacía envía null para conservar la actual', async () => {
    await actualizarUsuario('u1', { nombre: 'Ana', email: 'ana@almacen.local', telefono: '04141234567', rol: 'repartidor', password: '' })

    expect(llamada().url.pathname).toBe('/usuarios/u1')
    expect(llamada()).toMatchObject({
      metodo: 'PUT',
      cuerpo: { nombre: 'Ana', email: 'ana@almacen.local', telefono: '04141234567', rol: 'repartidor', password: null },
    })
  })

  it.each([
    [true, '/usuarios/u1/activar'],
    [false, '/usuarios/u1/desactivar'],
  ])('cambiarActivo(%s) llama a %s', async (activo, ruta) => {
    await cambiarActivo('u1', activo)

    expect(llamada().url.pathname).toBe(ruta)
    expect(llamada().metodo).toBe('POST')
  })
})
