import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cerrarSesion, login } from './auth'
import { guardarToken, obtenerToken } from './cliente'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn()
  vi.stubGlobal('fetch', fetchSimulado)
})

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })

describe('login', () => {
  it('envía el correo sin espacios y guarda el token y el refresh token', async () => {
    fetchSimulado.mockResolvedValue(json(200, { token: 'jwt', refreshToken: 'refresh', rol: 'ventas' }))

    const sesion = await login({ correo: '  ventas1@almacen.local ', clave: 'Demo1234!' })

    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(url.toString()).toBe('http://api.pruebas/auth/login')
    expect(JSON.parse(opciones.body)).toEqual({ email: 'ventas1@almacen.local', password: 'Demo1234!' })
    expect(sesion.rol).toBe('ventas')
    expect(obtenerToken()).toBe('jwt')
    expect(localStorage.getItem('almacen.refresh')).toBe('refresh')
  })

  it('con credenciales incorrectas no guarda nada', async () => {
    fetchSimulado.mockResolvedValue(json(401, { mensaje: 'Correo o contraseña incorrectos.' }))

    await expect(login({ correo: 'x@y.z', clave: 'mal' })).rejects.toThrow('Correo o contraseña incorrectos.')

    expect(obtenerToken()).toBeNull()
    expect(localStorage.getItem('almacen.refresh')).toBeNull()
  })
})

describe('cerrarSesion', () => {
  it('revoca el refresh token en la API y limpia el navegador', async () => {
    guardarToken('jwt')
    localStorage.setItem('almacen.refresh', 'refresh')
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }))

    await cerrarSesion()

    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(url.toString()).toBe('http://api.pruebas/auth/logout')
    expect(JSON.parse(opciones.body)).toEqual({ refreshToken: 'refresh' })
    expect(obtenerToken()).toBeNull()
    expect(localStorage.getItem('almacen.refresh')).toBeNull()
  })

  it('si la API no responde, igual cierra la sesión local', async () => {
    guardarToken('jwt')
    localStorage.setItem('almacen.refresh', 'refresh')
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'))

    await cerrarSesion()

    expect(obtenerToken()).toBeNull()
    expect(localStorage.getItem('almacen.refresh')).toBeNull()
  })

  it('sin refresh token no llama a la API', async () => {
    guardarToken('jwt')

    await cerrarSesion()

    expect(fetchSimulado).not.toHaveBeenCalled()
    expect(obtenerToken()).toBeNull()
  })
})
