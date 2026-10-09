import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Inicio from './Inicio'
import { renderizar } from '../../test/renderizar'

describe('Inicio del repartidor', () => {
  it('muestra el título del área de entregas', () => {
    renderizar(<Inicio />, { ruta: '/repartidor', rol: 'repartidor' })

    expect(screen.getByRole('heading', { level: 2, name: /Entregas/ })).toBeInTheDocument()
    expect(screen.getByText(/pensada para el celular/)).toBeInTheDocument()
  })

  it('lista las cinco secciones previstas, todas marcadas como pendientes', () => {
    renderizar(<Inicio />, { ruta: '/repartidor', rol: 'repartidor' })

    const secciones = screen.getAllByRole('article')
    expect(secciones.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Mis entregas',
      'Detalle del pedido',
      'Abrir en el mapa',
      'Cambiar estado',
      'Historial',
    ])
    for (const seccion of secciones) {
      expect(within(seccion).getByText('Por construir')).toBeInTheDocument()
    }
  })
})
