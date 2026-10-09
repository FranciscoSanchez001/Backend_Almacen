import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Layout from './Layout'
import { renderizar } from '../test/renderizar'

vi.mock('../api/auth', () => ({
  INICIO_POR_ROL: { superadmin: '/admin', ventas: '/panel', repartidor: '/repartidor' },
  login: vi.fn(),
  cerrarSesion: vi.fn(),
}))

// Layout con una página hija, como en App.jsx (área de entregas).
function AreaConLayout({ perfil }) {
  return (
    <Routes>
      <Route element={<Layout titulo="Entregas" perfil={perfil} />}>
        <Route index element={<p>Contenido del área</p>} />
      </Route>
    </Routes>
  )
}

describe('Layout', () => {
  it('muestra el título del área y la página hija', () => {
    renderizar(<AreaConLayout />, { ruta: '/repartidor', patron: '/repartidor/*' })

    expect(screen.getByRole('heading', { name: 'Entregas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Contenido del área')).toBeInTheDocument()
  })

  it('sin la opción perfil no muestra el menú de cuenta ni el botón de tema', () => {
    renderizar(<AreaConLayout />, { ruta: '/repartidor', patron: '/repartidor/*', rol: 'repartidor' })

    expect(screen.queryByRole('button', { name: 'Mi cuenta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar a modo oscuro' })).not.toBeInTheDocument()
  })

  it('con la opción perfil muestra el menú de cuenta y el botón de tema', () => {
    renderizar(<AreaConLayout perfil />, { ruta: '/repartidor', patron: '/repartidor/*', rol: 'repartidor' })

    expect(screen.getByRole('button', { name: 'Mi cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument()
  })
})
