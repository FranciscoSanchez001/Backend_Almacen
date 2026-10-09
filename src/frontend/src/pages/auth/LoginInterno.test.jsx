import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginInterno from './LoginInterno'
import { AuthProvider } from '../../context/AuthContext'
import { ThemeProvider } from '../../context/ThemeContext'
import { login } from '../../api/auth'
import { renderizar } from '../../test/renderizar'
import { crearToken } from '../../test/jwt'

// Se simula la llamada a la API; INICIO_POR_ROL se mantiene igual que en la app.
vi.mock('../../api/auth', () => ({
  INICIO_POR_ROL: { superadmin: '/admin', ventas: '/panel', repartidor: '/repartidor' },
  login: vi.fn(),
  cerrarSesion: vi.fn(),
}))

function Ubicacion() {
  const { pathname } = useLocation()
  return <p data-testid="ubicacion">{pathname}</p>
}

// Login con la ruta de origen en el estado de navegación (como lo deja RutaProtegida).
function renderizarDesde(desde) {
  const user = userEvent.setup()
  render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/internal-login', state: { desde } }]}>
          <Routes>
            <Route path="/internal-login" element={<LoginInterno />} />
            <Route path="*" element={<Ubicacion />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  )
  return { user }
}

async function completarYEnviar(user, correo = 'ventas1@almacen.local', clave = 'Demo1234!') {
  await user.type(screen.getByLabelText('Correo'), correo)
  await user.type(screen.getByLabelText('Contraseña'), clave)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

const sesionDe = (rol) => ({ token: crearToken({ rol }), refreshToken: 'refresh', rol })

beforeEach(() => {
  vi.mocked(login).mockReset()
})

describe('LoginInterno: formulario', () => {
  it('muestra los campos de correo y contraseña obligatorios', () => {
    renderizar(<LoginInterno />, { ruta: '/internal-login' })

    expect(screen.getByRole('heading', { name: 'Supermercado' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toBeRequired()
    expect(screen.getByLabelText('Contraseña')).toBeRequired()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('no envía el formulario con los campos vacíos', async () => {
    const { user } = renderizar(<LoginInterno />, { ruta: '/internal-login' })

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(login).not.toHaveBeenCalled()
  })

  it('envía el correo y la contraseña escritos', async () => {
    vi.mocked(login).mockResolvedValue(sesionDe('ventas'))
    const { user } = renderizar(<LoginInterno />, { ruta: '/internal-login' })

    await completarYEnviar(user, 'ventas1@almacen.local', 'Demo1234!')

    expect(login).toHaveBeenCalledWith({ correo: 'ventas1@almacen.local', clave: 'Demo1234!' })
  })

  it('muestra el error de la API y vuelve a habilitar el botón', async () => {
    vi.mocked(login).mockRejectedValue(new Error('Correo o contraseña incorrectos.'))
    const { user } = renderizar(<LoginInterno />, { ruta: '/internal-login' })

    await completarYEnviar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByTestId('ubicacion')).not.toBeInTheDocument()
  })

  it('deshabilita el botón mientras espera la respuesta', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {}))
    const { user } = renderizar(<LoginInterno />, { ruta: '/internal-login' })

    await completarYEnviar(user)

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
  })
})

describe('LoginInterno: redirección tras el login', () => {
  it.each([
    ['superadmin', '/admin'],
    ['ventas', '/panel'],
    ['repartidor', '/repartidor'],
  ])('el rol %s va a %s', async (rol, destino) => {
    vi.mocked(login).mockResolvedValue(sesionDe(rol))
    const { user } = renderizar(<LoginInterno />, { ruta: '/internal-login' })

    await completarYEnviar(user)

    expect(await screen.findByTestId('ubicacion')).toHaveTextContent(destino)
  })

  it('vuelve a la página que pedía si es de su área', async () => {
    vi.mocked(login).mockResolvedValue(sesionDe('ventas'))
    const { user } = renderizarDesde('/panel/pedidos')

    await completarYEnviar(user)

    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/panel/pedidos')
  })

  it('el gerente también vuelve a una página del panel de ventas', async () => {
    vi.mocked(login).mockResolvedValue(sesionDe('superadmin'))
    const { user } = renderizarDesde('/panel/inventario')

    await completarYEnviar(user)

    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/panel/inventario')
  })

  it('si la página pedida no es de su área, va a su inicio', async () => {
    vi.mocked(login).mockResolvedValue(sesionDe('ventas'))
    const { user } = renderizarDesde('/admin/personal')

    await completarYEnviar(user)

    expect(await screen.findByTestId('ubicacion')).toHaveTextContent(/^\/panel$/)
  })
})

describe('LoginInterno: con sesión abierta', () => {
  it.each([
    ['superadmin', '/admin'],
    ['ventas', '/panel'],
    ['repartidor', '/repartidor'],
  ])('el rol %s se redirige directo a %s', (rol, destino) => {
    renderizar(<LoginInterno />, { ruta: '/internal-login', rol })

    expect(screen.getByTestId('ubicacion')).toHaveTextContent(destino)
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument()
  })
})
