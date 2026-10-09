import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NoEncontrada from './NoEncontrada'
import { renderizar } from '../test/renderizar'

describe('NoEncontrada', () => {
  it('informa que la página no existe', () => {
    renderizar(<NoEncontrada />, { ruta: '/no-existe' })

    expect(screen.getByText('Esta página no existe')).toBeInTheDocument()
  })
})
