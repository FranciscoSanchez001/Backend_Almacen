import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from './notificaciones'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  vi.stubGlobal('fetch', fetchSimulado)
})

const llamada = () => {
  const [url, opciones] = fetchSimulado.mock.calls[0]
  return { url: new URL(url.toString()), metodo: opciones.method }
}

describe('notificaciones', () => {
  it('listarNotificaciones pide solo las no leídas por defecto', async () => {
    await listarNotificaciones()

    expect(llamada().url.pathname).toBe('/notificaciones')
    expect(llamada().url.searchParams.get('soloNoLeidas')).toBe('true')
  })

  it('listarNotificaciones puede pedir también las leídas', async () => {
    await listarNotificaciones({ soloNoLeidas: false })

    expect(llamada().url.searchParams.get('soloNoLeidas')).toBe('false')
  })

  it('marcarLeida marca un aviso con POST', async () => {
    await marcarLeida('n1')

    expect(llamada().url.pathname).toBe('/notificaciones/n1/leer')
    expect(llamada().metodo).toBe('POST')
  })

  it('marcarTodasLeidas marca todos los avisos con POST', async () => {
    await marcarTodasLeidas()

    expect(llamada().url.pathname).toBe('/notificaciones/leer-todas')
    expect(llamada().metodo).toBe('POST')
  })
})
