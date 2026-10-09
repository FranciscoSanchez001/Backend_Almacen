import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BotonTema from './BotonTema'
import { renderizar } from '../test/renderizar'

describe('BotonTema', () => {
  it('en tema claro ofrece pasar al modo oscuro', () => {
    renderizar(<BotonTema />)

    const boton = screen.getByRole('button', { name: 'Cambiar a modo oscuro' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
  })

  it('al pulsarlo activa el modo oscuro y luego permite volver al claro', async () => {
    const { user } = renderizar(<BotonTema />)

    await user.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))

    const boton = screen.getByRole('button', { name: 'Cambiar a tema claro' })
    expect(boton).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveClass('dark')

    await user.click(boton)

    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('arranca en oscuro si esa fue la preferencia guardada', () => {
    localStorage.setItem('almacen.tema', 'oscuro')

    renderizar(<BotonTema />)

    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeInTheDocument()
  })
})
