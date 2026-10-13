import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BotonGoogle from './BotonGoogle'
import { renderizar } from '../test/renderizar'
import { obtenerToken } from '../api/cliente'
import { crearToken } from '../test/jwt'

// Google Identity Services simulado: guarda el callback para poder "iniciar sesión" desde la prueba.
let gis
beforeEach(() => {
  gis = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id: gis } })
})

const responder = (estado, cuerpo) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })),
  )

describe('BotonGoogle', () => {
  it('inicializa Google con el Client ID y dibuja el botón', async () => {
    renderizar(<BotonGoogle />)

    await waitFor(() => expect(gis.renderButton).toHaveBeenCalled())
    expect(gis.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cliente-pruebas.apps.googleusercontent.com' }))
    expect(gis.renderButton.mock.calls[0][1]).toMatchObject({ text: 'continue_with', locale: 'es' })
  })

  it('con el ID token de Google abre la sesión del cliente y avisa', async () => {
    const token = crearToken({ rol: 'cliente', nombre: 'Ana Pérez' })
    responder(200, { token, refreshToken: 'refresh' })
    const alIngresar = vi.fn()
    renderizar(<BotonGoogle alIngresar={alIngresar} />)
    await waitFor(() => expect(gis.initialize).toHaveBeenCalled())

    await act(() => gis.initialize.mock.calls[0][0].callback({ credential: 'id-token' }))

    expect(alIngresar).toHaveBeenCalledWith(expect.objectContaining({ rol: 'cliente', nombre: 'Ana Pérez' }))
    expect(obtenerToken()).toBe(token)
  })

  it('si la API rechaza el token muestra el motivo', async () => {
    responder(409, { mensaje: 'Ese correo pertenece al personal; entra con usuario y contraseña.' })
    renderizar(<BotonGoogle />)
    await waitFor(() => expect(gis.initialize).toHaveBeenCalled())

    await act(() => gis.initialize.mock.calls[0][0].callback({ credential: 'id-token' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ese correo pertenece al personal')
    expect(obtenerToken()).toBeNull()
  })

  it('sin Client ID configurado avisa en lugar de mostrar el botón', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    vi.resetModules()
    // Módulos frescos: el Client ID se lee al cargar BotonGoogle, y el contexto tiene que ser el mismo.
    const { default: BotonSinConfigurar } = await import('./BotonGoogle')
    const { renderizar: renderizarFresco } = await import('../test/renderizar')

    renderizarFresco(<BotonSinConfigurar />)

    expect(screen.getByRole('alert')).toHaveTextContent('no está configurado (VITE_GOOGLE_CLIENT_ID)')
    expect(gis.initialize).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})
