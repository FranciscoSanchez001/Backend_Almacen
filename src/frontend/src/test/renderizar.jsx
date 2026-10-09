// Renderiza un componente como lo hace la app: con los proveedores de tema, sesión y
// carrito, y dentro de un router en memoria. Así cada prueba elige la ruta inicial y
// el rol con el que entra, y puede comprobar a dónde navegó la pantalla.
// Solo lo usan las pruebas, así que la regla de Fast Refresh no aplica.
/* eslint-disable react-refresh/only-export-components */
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CarritoProvider } from '../context/CarritoContext'
import { ThemeProvider } from '../context/ThemeContext'
import { guardarToken } from '../api/cliente'
import { crearToken } from './jwt'

// Pantalla de destino para las rutas que no son la probada: muestra la ruta a la que se navegó.
function UbicacionActual() {
  const { pathname, search } = useLocation()
  return <p data-testid="ubicacion">{pathname + search}</p>
}

/**
 * @param ui        Elemento a renderizar.
 * @param opciones.ruta    Ruta inicial (por defecto "/").
 * @param opciones.patron  Patrón de la ruta donde se monta `ui` (por defecto, la ruta sin query).
 * @param opciones.rol     Si se indica, abre una sesión con ese rol antes de renderizar.
 * @param opciones.nombre  Nombre del usuario de la sesión.
 * @returns El resultado de render() más `user` (userEvent ya configurado).
 */
export function renderizar(ui, { ruta = '/', patron, rol, nombre } = {}) {
  if (rol) guardarToken(crearToken({ rol, nombre }))
  const user = userEvent.setup()
  const resultado = render(
    <ThemeProvider>
      <AuthProvider>
        <CarritoProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              <Route path={patron ?? ruta.split('?')[0]} element={ui} />
              <Route path="*" element={<UbicacionActual />} />
            </Routes>
          </MemoryRouter>
        </CarritoProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
  return { ...resultado, user }
}

// Página paginada como la devuelve la API: { items, total, pagina, tamano }.
export const pagina = (items, extra = {}) => ({ items, total: items.length, pagina: 1, tamano: 50, ...extra })
