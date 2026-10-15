import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarPruebaWhatsapp, listarMensajesWhatsapp, obtenerEstadoWhatsapp, vincularWhatsapp } from './whatsapp'

let fetchSimulado
beforeEach(() => {
  fetchSimulado = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchSimulado)
})
const llamada = () => fetchSimulado.mock.calls[0]
const url = () => new URL(llamada()[0].toString())

describe('api/whatsapp', () => {
  it('consulta el estado', async () => {
    await obtenerEstadoWhatsapp()
    expect(url().pathname).toBe('/whatsapp/estado')
  })

  it('vincula con POST', async () => {
    await vincularWhatsapp()
    expect(url().pathname).toBe('/whatsapp/vincular')
    expect(llamada()[1].method).toBe('POST')
  })

  it('envía la prueba con el teléfono', async () => {
    await enviarPruebaWhatsapp('+58 412 123 4567')
    expect(url().pathname).toBe('/whatsapp/prueba')
    expect(JSON.parse(llamada()[1].body)).toEqual({ telefono: '+58 412 123 4567' })
  })

  it('lista los mensajes con límite', async () => {
    await listarMensajesWhatsapp({ limite: 10 })
    expect(url().searchParams.get('limite')).toBe('10')
  })
})
