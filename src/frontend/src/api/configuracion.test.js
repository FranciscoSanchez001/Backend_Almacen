import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  actualizarZona,
  cargarTasa,
  crearZona,
  guardarConfiguracion,
  historialTasas,
  listarZonas,
  obtenerConfiguracion,
} from './configuracion'

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

describe('configuración', () => {
  it('obtenerConfiguracion hace GET /configuracion', async () => {
    await obtenerConfiguracion()

    expect(llamada().url.pathname).toBe('/configuracion')
    expect(llamada().metodo).toBe('GET')
  })

  it('guardarConfiguracion envía los datos con PUT', async () => {
    const datos = { numeroSoporte: '+584141234567', horasExpiracion: 5 }

    await guardarConfiguracion(datos)

    expect(llamada()).toMatchObject({ metodo: 'PUT', cuerpo: datos })
    expect(llamada().url.pathname).toBe('/configuracion')
  })

  it('cargarTasa envía la tasa del día', async () => {
    await cargarTasa(36.5)

    expect(llamada().url.pathname).toBe('/configuracion/tasa')
    expect(llamada()).toMatchObject({ metodo: 'PUT', cuerpo: { tasa: 36.5 } })
  })

  it('historialTasas pagina de 10 en 10 por defecto', async () => {
    await historialTasas()

    expect(llamada().url.pathname).toBe('/configuracion/tasas')
    expect(Object.fromEntries(llamada().url.searchParams)).toEqual({ pagina: '1', tamano: '10' })
  })

  it('listarZonas hace GET /zonas', async () => {
    await listarZonas()

    expect(llamada().url.pathname).toBe('/zonas')
    expect(llamada().metodo).toBe('GET')
  })

  it('crearZona envía el nombre con POST', async () => {
    await crearZona('Centro')

    expect(llamada().url.pathname).toBe('/zonas')
    expect(llamada()).toMatchObject({ metodo: 'POST', cuerpo: { nombre: 'Centro' } })
  })

  it('actualizarZona envía nombre y estado con PUT', async () => {
    await actualizarZona('z1', { nombre: 'Barrio Obrero', activa: false })

    expect(llamada().url.pathname).toBe('/zonas/z1')
    expect(llamada()).toMatchObject({ metodo: 'PUT', cuerpo: { nombre: 'Barrio Obrero', activa: false } })
  })
})
