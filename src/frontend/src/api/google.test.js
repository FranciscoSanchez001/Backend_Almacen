import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => document.querySelectorAll('script[src*="accounts.google.com/gsi/client"]').forEach((script) => script.remove()))

describe('Google Identity Services', () => {
  it('comparte una sola carga del SDK y devuelve la API al terminar', async () => {
    const { cargarGoogle } = await import('./google')
    const primera = cargarGoogle()
    expect(cargarGoogle()).toBe(primera)
    expect(document.querySelectorAll('script[src*="accounts.google.com/gsi/client"]')).toHaveLength(1)
    const id = { initialize: vi.fn() }
    vi.stubGlobal('google', { accounts: { id } })
    document.querySelector('script[src*="accounts.google.com/gsi/client"]').onload()
    await expect(primera).resolves.toBe(id)
  })

  it('el fallo de descarga permite una carga nueva', async () => {
    const { cargarGoogle } = await import('./google')
    const primera = cargarGoogle()
    const fallo = expect(primera).rejects.toThrow('No se pudo cargar Google')
    document.querySelector('script[src*="accounts.google.com/gsi/client"]').onerror()
    await fallo
    const segunda = cargarGoogle()
    expect(segunda).not.toBe(primera)
    const id = {}
    vi.stubGlobal('google', { accounts: { id } })
    document.querySelector('script[src*="accounts.google.com/gsi/client"]').onload()
    await expect(segunda).resolves.toBe(id)
  })

  it('una descarga que no termina devuelve un error tras el límite de espera', async () => {
    vi.useFakeTimers()
    const { cargarGoogle } = await import('./google')
    const fallo = expect(cargarGoogle()).rejects.toThrow('No se pudo cargar Google')
    await vi.advanceTimersByTimeAsync(15000)
    await fallo
    expect(document.querySelector('script[src*="accounts.google.com/gsi/client"]')).toBeNull()
  })

  it('inicializa una sola vez, desvincula el diálogo cerrado y entrega la credencial al nuevo', async () => {
    const { mostrarBotonGoogle } = await import('./google')
    const google = { initialize: vi.fn(), renderButton: vi.fn() }
    const elemento = document.createElement('div')
    const primera = vi.fn()
    const limpiar = mostrarBotonGoogle(google, elemento, 'cliente', primera)
    const callback = google.initialize.mock.calls[0][0].callback
    limpiar()
    callback({ credential: 'tardia' })
    expect(primera).not.toHaveBeenCalled()
    const segunda = vi.fn()
    mostrarBotonGoogle(google, elemento, 'cliente', segunda)
    callback({ credential: 'vigente' })
    expect(segunda).toHaveBeenCalledWith({ credential: 'vigente' })
    expect(google.initialize).toHaveBeenCalledOnce()
  })
})
