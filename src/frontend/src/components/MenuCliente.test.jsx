import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MenuCliente from './MenuCliente'
import { renderizar } from '../test/renderizar'
import { obtenerToken } from '../api/cliente'

beforeEach(() => {
  vi.stubGlobal('google', { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
})

describe('MenuCliente', () => {
  it('sin sesión, "Ingresar" abre el acceso con Google', async () => {
    const { user } = renderizar(<MenuCliente />)

    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(screen.getByRole('dialog', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument()
    expect(screen.getByText(/Usa tu cuenta de Google/)).toBeInTheDocument()
  })

  it('un cliente ve su cuenta, el enlace a sus pedidos y puede cerrar sesión', async () => {
    const { user } = renderizar(<MenuCliente />, { rol: 'cliente', nombre: 'Ana Pérez' })

    await user.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Mis pedidos' })).toHaveAttribute('href', '/mis-pedidos')

    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(obtenerToken()).toBeNull()
  })

  it('el personal solo ve el enlace a su panel', () => {
    renderizar(<MenuCliente />, { rol: 'ventas' })

    expect(screen.getByRole('link', { name: 'Ir a mi panel' })).toHaveAttribute('href', '/panel')
    expect(screen.queryByRole('button', { name: 'Ingresar' })).not.toBeInTheDocument()
  })
})
