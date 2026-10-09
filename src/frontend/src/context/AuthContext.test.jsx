import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { guardarToken } from '../api/cliente'
import { cerrarSesion, login } from '../api/auth'
import { crearToken } from '../test/jwt'

// La capa api/auth se simula: aquí se prueba solo la sesión del contexto.
vi.mock('../api/auth', () => ({ login: vi.fn(), cerrarSesion: vi.fn() }))

// Muestra el estado de la sesión y expone las acciones como botones.
function Sonda() {
  const { usuario, login: iniciar, logout, tieneRol } = useAuth()
  return (
    <div>
      <p data-testid="usuario">{usuario ? `${usuario.nombre} (${usuario.rol})` : 'sin sesión'}</p>
      <p data-testid="es-gerente">{String(tieneRol('superadmin'))}</p>
      <p data-testid="es-personal">{String(tieneRol('ventas', 'superadmin'))}</p>
      <button onClick={() => iniciar({ correo: 'a@b.c', clave: 'x' })}>Entrar</button>
      <button onClick={logout}>Salir</button>
    </div>
  )
}

const renderizar = () =>
  render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>,
  )

beforeEach(() => {
  vi.mocked(login).mockReset()
  vi.mocked(cerrarSesion).mockReset().mockResolvedValue(undefined)
})

describe('AuthContext: sesión guardada', () => {
  it('sin token arranca sin sesión', () => {
    renderizar()

    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
    expect(screen.getByTestId('es-gerente')).toHaveTextContent('false')
  })

  it('con un token vigente recupera el usuario del JWT, incluidos los acentos del nombre', () => {
    guardarToken(crearToken({ rol: 'superadmin', nombre: 'María Fernández' }))

    renderizar()

    expect(screen.getByTestId('usuario')).toHaveTextContent('María Fernández (superadmin)')
    expect(screen.getByTestId('es-gerente')).toHaveTextContent('true')
    expect(screen.getByTestId('es-personal')).toHaveTextContent('true')
  })

  it('ignora un token vencido', () => {
    guardarToken(crearToken({ minutos: -5 }))

    renderizar()

    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
  })

  it('ignora un token malformado', () => {
    guardarToken('esto-no-es-un-jwt')

    renderizar()

    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
  })
})

describe('AuthContext: cierre automático', () => {
  it('cierra la sesión cuando la API avisa con "sesion-expirada"', () => {
    guardarToken(crearToken({ rol: 'ventas' }))
    renderizar()

    act(() => window.dispatchEvent(new Event('sesion-expirada')))

    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
  })

  it('cierra la sesión al llegar la hora de vencimiento del token', () => {
    vi.useFakeTimers()
    guardarToken(crearToken({ rol: 'ventas', minutos: 1 }))
    renderizar()
    expect(screen.getByTestId('usuario')).toHaveTextContent('(ventas)')

    act(() => vi.advanceTimersByTime(61_000))

    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
  })
})

describe('AuthContext: login y logout', () => {
  it('login decodifica el token recibido y abre la sesión', async () => {
    vi.mocked(login).mockResolvedValue({ token: crearToken({ rol: 'ventas', nombre: 'Vendedor' }) })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(login).toHaveBeenCalledWith({ correo: 'a@b.c', clave: 'x' })
    expect(screen.getByTestId('usuario')).toHaveTextContent('Vendedor (ventas)')
    expect(screen.getByTestId('es-gerente')).toHaveTextContent('false')
  })

  it('logout revoca la sesión en la API y la cierra', async () => {
    guardarToken(crearToken({ rol: 'superadmin' }))
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(cerrarSesion).toHaveBeenCalledOnce()
    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión')
  })
})
