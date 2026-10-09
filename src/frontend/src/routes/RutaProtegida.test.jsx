import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RutaProtegida from './RutaProtegida'
import { AuthProvider } from '../context/AuthContext'
import { guardarToken } from '../api/cliente'
import { crearToken } from '../test/jwt'

// Muestra en qué ruta terminó la navegación y desde dónde se redirigió.
function Destino({ nombre }) {
  const { pathname, state } = useLocation()
  return (
    <p>
      {nombre} · {pathname}
      {state?.desde ? ` · desde ${state.desde}` : ''}
    </p>
  )
}

// Las mismas áreas que App.jsx, con contenido mínimo.
function renderizarEn(ruta) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/internal-login" element={<Destino nombre="Login" />} />
          <Route path="/" element={<Destino nombre="Tienda" />} />
          <Route
            path="/panel"
            element={
              <RutaProtegida roles={['ventas', 'superadmin']}>
                <Destino nombre="Panel" />
              </RutaProtegida>
            }
          />
          <Route path="/admin" element={<RutaProtegida roles={['superadmin']} />}>
            <Route index element={<Destino nombre="Admin" />} />
          </Route>
          <Route
            path="/repartidor"
            element={
              <RutaProtegida roles={['repartidor', 'superadmin']}>
                <Destino nombre="Entregas" />
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const sesionComo = (rol) => guardarToken(crearToken({ rol }))

describe('RutaProtegida', () => {
  it('sin sesión redirige al login recordando la ruta pedida', () => {
    renderizarEn('/panel')

    expect(screen.getByText('Login · /internal-login · desde /panel')).toBeInTheDocument()
  })

  it.each([
    ['ventas', '/panel', 'Panel'],
    ['superadmin', '/panel', 'Panel'],
    ['superadmin', '/admin', 'Admin'],
    ['repartidor', '/repartidor', 'Entregas'],
    ['superadmin', '/repartidor', 'Entregas'],
  ])('el rol %s puede entrar a %s', (rol, ruta, pantalla) => {
    sesionComo(rol)

    renderizarEn(ruta)

    expect(screen.getByText(`${pantalla} · ${ruta}`)).toBeInTheDocument()
  })

  it.each([
    ['ventas', '/admin', 'Panel · /panel'],
    ['ventas', '/repartidor', 'Panel · /panel'],
    ['repartidor', '/panel', 'Entregas · /repartidor'],
    ['repartidor', '/admin', 'Entregas · /repartidor'],
  ])('el rol %s no entra a %s y vuelve a su inicio', (rol, ruta, esperado) => {
    sesionComo(rol)

    renderizarEn(ruta)

    expect(screen.getByText(esperado)).toBeInTheDocument()
  })

  it('un rol desconocido termina en la tienda', () => {
    sesionComo('cliente')

    renderizarEn('/panel')

    expect(screen.getByText('Tienda · /')).toBeInTheDocument()
  })
})
