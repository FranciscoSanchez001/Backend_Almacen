import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MenuPerfil from './MenuPerfil'
import { cerrarSesion } from '../api/auth'
import { renderizar } from '../test/renderizar'

vi.mock('../api/auth', () => ({
  INICIO_POR_ROL: { superadmin: '/admin', ventas: '/panel', repartidor: '/repartidor' },
  login: vi.fn(),
  cerrarSesion: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(cerrarSesion).mockReset().mockResolvedValue(undefined)
})

describe('MenuPerfil', () => {
  it('sin sesión muestra el enlace para iniciar sesión', () => {
    renderizar(<MenuPerfil />, { ruta: '/panel' })

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/internal-login')
    expect(screen.queryByRole('button', { name: 'Mi cuenta' })).not.toBeInTheDocument()
  })

  it('muestra las iniciales del usuario y el menú cerrado', () => {
    renderizar(<MenuPerfil />, { ruta: '/panel', rol: 'ventas', nombre: 'María Fernanda Cachopo' })

    const boton = screen.getByRole('button', { name: 'Mi cuenta' })
    expect(boton).toHaveTextContent('MF')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it.each([
    ['superadmin', 'Administrador'],
    ['ventas', 'Ventas'],
    ['repartidor', 'Repartidor'],
  ])('al abrirlo con el rol %s muestra los datos de la cuenta y el tipo "%s"', async (rol, tipo) => {
    const { user } = renderizar(<MenuPerfil />, { ruta: '/panel', rol, nombre: 'Gregorio Briceño' })

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('Gregorio Briceño')
    expect(menu).toHaveTextContent('prueba@almacen.local')
    expect(menu).toHaveTextContent(tipo)
    expect(screen.getByRole('button', { name: 'Mi cuenta' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('se cierra con la tecla Escape', async () => {
    const { user } = renderizar(<MenuPerfil />, { ruta: '/panel', rol: 'ventas' })
    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('se cierra al hacer clic fuera', async () => {
    const { user } = renderizar(<MenuPerfil />, { ruta: '/panel', rol: 'ventas' })
    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    await user.click(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Cerrar sesión revoca la sesión y lleva al login interno', async () => {
    const { user } = renderizar(<MenuPerfil />, { ruta: '/panel', rol: 'ventas' })
    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(cerrarSesion).toHaveBeenCalledOnce()
    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/internal-login')
  })
})
