import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CarritoProvider } from './context/CarritoContext'
import { ThemeProvider } from './context/ThemeContext'
import { guardarToken } from './api/cliente'
import { listarNotificaciones } from './api/notificaciones'
import { listarCategorias } from './api/catalogo'
import { crearToken } from './test/jwt'

// Cada página se reemplaza por un texto identificable: aquí solo se prueba el enrutado
// (qué página se carga para cada ruta y rol), no el contenido de las páginas.
vi.mock('./pages/tienda/Catalogo', () => ({ default: () => 'Página Catálogo' }))
vi.mock('./pages/panel/Resumen', () => ({ default: () => 'Página Resumen' }))
vi.mock('./pages/panel/Pedidos', () => ({ default: () => 'Página Pedidos' }))
vi.mock('./pages/panel/Productos', () => ({ default: () => 'Página Productos' }))
vi.mock('./pages/panel/Inventario', () => ({ default: () => 'Página Inventario' }))
vi.mock('./pages/panel/Clientes', () => ({ default: () => 'Página Clientes' }))
vi.mock('./pages/admin/PowerBIDashboard', () => ({ default: () => 'Página Dashboard' }))
vi.mock('./pages/admin/Personal', () => ({ default: () => 'Página Personal' }))
vi.mock('./pages/admin/Auditoria', () => ({ default: () => 'Página Auditoría' }))
vi.mock('./pages/admin/Configuracion', () => ({ default: () => 'Página Configuración' }))
vi.mock('./pages/repartidor/Inicio', () => ({ default: () => 'Página Entregas' }))

// Las llamadas que hacen los layouts al montarse.
vi.mock('./api/catalogo', () => ({ listarCatalogo: vi.fn(), listarCategorias: vi.fn() }))
vi.mock('./api/notificaciones', () => ({ listarNotificaciones: vi.fn(), marcarLeida: vi.fn(), marcarTodasLeidas: vi.fn() }))

// Igual que main.jsx, con un router en memoria.
function renderizarApp(ruta, rol) {
  if (rol) guardarToken(crearToken({ rol }))
  render(
    <ThemeProvider>
      <AuthProvider>
        <CarritoProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <App />
          </MemoryRouter>
        </CarritoProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.mocked(listarCategorias).mockReset().mockResolvedValue([])
  vi.mocked(listarNotificaciones).mockReset().mockResolvedValue({ items: [], total: 0 })
})

describe('App: áreas públicas', () => {
  it('la raíz muestra la tienda con su encabezado', async () => {
    renderizarApp('/')

    expect(await screen.findByText('Página Catálogo')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar productos' })).toBeInTheDocument()
  })

  it('/internal-login muestra el acceso del personal', async () => {
    renderizarApp('/internal-login')

    expect(await screen.findByText('Acceso interno · Personal')).toBeInTheDocument()
  })

  it('una ruta inexistente muestra la página 404', async () => {
    renderizarApp('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument()
  })
})

describe('App: panel de ventas', () => {
  it.each([
    ['/panel', 'Página Resumen'],
    ['/panel/pedidos', 'Página Pedidos'],
    ['/panel/productos', 'Página Productos'],
    ['/panel/inventario', 'Página Inventario'],
    ['/panel/clientes', 'Página Clientes'],
  ])('ventas en %s ve "%s" dentro del panel', async (ruta, pagina) => {
    renderizarApp(ruta, 'ventas')

    expect(await screen.findByText(pagina)).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Menú del panel' }).length).toBeGreaterThan(0)
  })

  it('el gerente también entra al panel de ventas', async () => {
    renderizarApp('/panel/pedidos', 'superadmin')

    expect(await screen.findByText('Página Pedidos')).toBeInTheDocument()
  })

  it('sin sesión el panel redirige al login', async () => {
    renderizarApp('/panel/pedidos')

    expect(await screen.findByText('Acceso interno · Personal')).toBeInTheDocument()
    expect(screen.queryByText('Página Pedidos')).not.toBeInTheDocument()
  })

  it('el repartidor no entra al panel y va a su área', async () => {
    renderizarApp('/panel', 'repartidor')

    expect(await screen.findByText('Página Entregas')).toBeInTheDocument()
    expect(screen.queryByText('Página Resumen')).not.toBeInTheDocument()
  })
})

describe('App: administración', () => {
  it.each([
    ['/admin', 'Página Dashboard'],
    ['/admin/personal', 'Página Personal'],
    ['/admin/auditoria', 'Página Auditoría'],
    ['/admin/configuracion', 'Página Configuración'],
  ])('el gerente en %s ve "%s"', async (ruta, pagina) => {
    renderizarApp(ruta, 'superadmin')

    expect(await screen.findByText(pagina)).toBeInTheDocument()
  })

  it('ventas no entra a administración y vuelve a su panel', async () => {
    renderizarApp('/admin/personal', 'ventas')

    expect(await screen.findByText('Página Resumen')).toBeInTheDocument()
    expect(screen.queryByText('Página Personal')).not.toBeInTheDocument()
  })

  it('sin sesión administración redirige al login', async () => {
    renderizarApp('/admin')

    expect(await screen.findByText('Acceso interno · Personal')).toBeInTheDocument()
  })
})

describe('App: entregas', () => {
  it('el repartidor ve su área con el título Entregas y su menú de cuenta', async () => {
    renderizarApp('/repartidor', 'repartidor')

    expect(await screen.findByText('Página Entregas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entregas', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mi cuenta' })).toBeInTheDocument()
  })

  it('el gerente también entra al área de entregas', async () => {
    renderizarApp('/repartidor', 'superadmin')

    expect(await screen.findByText('Página Entregas')).toBeInTheDocument()
  })

  it('ventas no entra al área de entregas', async () => {
    renderizarApp('/repartidor', 'ventas')

    expect(await screen.findByText('Página Resumen')).toBeInTheDocument()
    expect(screen.queryByText('Página Entregas')).not.toBeInTheDocument()
  })
})
