import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activarAnalitica, desactivarAnalitica, enviarEventos, registrarEvento, sesionAnalitica } from './analitica'
import { guardarToken } from '../api/cliente'

let fetchSimulado

beforeEach(() => {
  vi.useFakeTimers()
  fetchSimulado = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchSimulado)
})

afterEach(() => {
  desactivarAnalitica()
  Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true })
})

const lote = (i = 0) => {
  const [url, opciones] = fetchSimulado.mock.calls[i]
  return { url: new URL(url.toString()), opciones, cuerpo: JSON.parse(opciones.body) }
}

describe('analítica del navegador', () => {
  it('apagada no guarda sesión ni envía nada', () => {
    registrarEvento('abrir_carrito')
    vi.advanceTimersByTime(10_000)

    expect(sesionAnalitica()).toBeNull()
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('junta los eventos y los manda en un lote a los 5 segundos', () => {
    activarAnalitica()
    registrarEvento('pagina_vista', { ruta: '/' })
    registrarEvento('agregar_carrito', { productoId: 'p1', cantidad: 2 })

    vi.advanceTimersByTime(4_999)
    expect(fetchSimulado).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(fetchSimulado).toHaveBeenCalledTimes(1)
    const { url, opciones, cuerpo } = lote()
    expect(url.href).toBe('http://api.pruebas/analitica/eventos')
    expect(opciones).toMatchObject({ method: 'POST', keepalive: true })
    expect(cuerpo.sesionId).toBe(sesionAnalitica())
    expect(cuerpo.eventos).toEqual([
      { tipo: 'pagina_vista', ruta: '/' },
      { tipo: 'agregar_carrito', productoId: 'p1', cantidad: 2 },
    ])
  })

  it('con 20 eventos pendientes envía enseguida', () => {
    activarAnalitica()
    for (let i = 0; i < 20; i++) registrarEvento('abrir_carrito')

    expect(fetchSimulado).toHaveBeenCalledTimes(1)
    expect(lote().cuerpo.eventos).toHaveLength(20)
  })

  it('al ocultar la página manda lo pendiente', () => {
    activarAnalitica()
    registrarEvento('inicio_checkout')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetchSimulado).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('manda el token si el cliente inició sesión', () => {
    guardarToken('jwt-cliente')
    activarAnalitica()
    registrarEvento('abrir_carrito')

    enviarEventos()

    expect(lote().opciones.headers.Authorization).toBe('Bearer jwt-cliente')
  })

  it('la visita se mantiene con actividad y cambia tras 30 minutos sin ella', () => {
    activarAnalitica()
    const primera = sesionAnalitica()

    vi.advanceTimersByTime(29 * 60_000)
    expect(sesionAnalitica()).toBe(primera)

    vi.advanceTimersByTime(31 * 60_000)
    expect(sesionAnalitica()).not.toBe(primera)
  })

  it('respeta "No rastrear"', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })

    activarAnalitica()
    registrarEvento('abrir_carrito')
    vi.advanceTimersByTime(10_000)

    expect(sesionAnalitica()).toBeNull()
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('si la red falla no rompe nada', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'))
    activarAnalitica()
    registrarEvento('abrir_carrito')

    expect(() => enviarEventos()).not.toThrow()
    await vi.runAllTimersAsync()
  })
})
