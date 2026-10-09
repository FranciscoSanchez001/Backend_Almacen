import { act, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PanelLayout from './PanelLayout'
import { listarNotificaciones } from '../api/notificaciones'
import { renderizar } from '../test/renderizar'

vi.mock('../api/notificaciones', () => ({
  listarNotificaciones: vi.fn(),
  marcarLeida: vi.fn(),
  marcarTodasLeidas: vi.fn(),
}))
vi.mock('../api/auth', () => ({
  INICIO_POR_ROL: { superadmin: '/admin', ventas: '/panel', repartidor: '/repartidor' },
  login: vi.fn(),
  cerrarSesion: vi.fn(),
}))

// Panel con algunas páginas hijas, como en App.jsx.
function Panel() {
  return (
    <Routes>
      <Route element={<PanelLayout />}>
        <Route path="/panel" element={<p>Página Resumen</p>} />
        <Route path="/panel/pedidos" element={<p>Página Pedidos</p>} />
        <Route path="/admin" element={<p>Página Dashboard</p>} />
      </Route>
    </Routes>
  )
}

const renderizarPanel = (rol, ruta = '/panel') => renderizar(<Panel />, { ruta, patron: '*', rol })

// La barra lateral de escritorio es el primer menú; el cajón móvil agrega otro al abrirse.
const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menú del panel' })[0]

beforeEach(() => {
  vi.mocked(listarNotificaciones).mockReset().mockResolvedValue({ items: [], total: 0 })
})

describe('PanelLayout: menú según el rol', () => {
  it('ventas ve solo las opciones de Ventas', () => {
    renderizarPanel('ventas')

    const menu = menuLateral()
    for (const opcion of ['Resumen', 'Pedidos', 'Productos', 'Inventario', 'Clientes']) {
      expect(within(menu).getByRole('link', { name: new RegExp(opcion) })).toBeInTheDocument()
    }
    expect(within(menu).queryByText('Administración')).not.toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /Dashboard KPI/ })).not.toBeInTheDocument()
  })

  it('el gerente ve Ventas y Administración', () => {
    renderizarPanel('superadmin', '/admin')

    const menu = menuLateral()
    expect(within(menu).getByRole('link', { name: /Pedidos/ })).toHaveAttribute('href', '/panel/pedidos')
    for (const [opcion, ruta] of [
      ['Dashboard KPI', '/admin'],
      ['Personal', '/admin/personal'],
      ['Auditoría', '/admin/auditoria'],
      ['Configuración', '/admin/configuracion'],
    ]) {
      expect(within(menu).getByRole('link', { name: new RegExp(opcion) })).toHaveAttribute('href', ruta)
    }
  })

  it('la marca indica el área según el rol', () => {
    renderizarPanel('ventas')
    expect(screen.getAllByText('Panel de ventas').length).toBeGreaterThan(0)
  })

  it('para el gerente la marca lleva a Administración', () => {
    renderizarPanel('superadmin', '/admin')

    const marcas = screen.getAllByRole('link', { name: /Supermercado/ })
    expect(marcas[0]).toHaveAttribute('href', '/admin')
  })

  it('marca como activa la opción de la página actual y muestra la página hija', () => {
    renderizarPanel('ventas', '/panel/pedidos')

    expect(screen.getByText('Página Pedidos')).toBeInTheDocument()
    expect(within(menuLateral()).getByRole('link', { name: /Pedidos/ })).toHaveAttribute('aria-current', 'page')
    expect(within(menuLateral()).getByRole('link', { name: /Resumen/ })).not.toHaveAttribute('aria-current')
  })

  it('navegar desde el menú cambia la página', async () => {
    const { user } = renderizarPanel('ventas')

    await user.click(within(menuLateral()).getByRole('link', { name: /Pedidos/ }))

    expect(screen.getByText('Página Pedidos')).toBeInTheDocument()
  })
})

describe('PanelLayout: cajón móvil', () => {
  it('se abre con el botón de menú y se cierra con Escape', async () => {
    const { user } = renderizarPanel('ventas')

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument()
  })

  it('se cierra con el botón Cerrar menú', async () => {
    const { user } = renderizarPanel('ventas')
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))

    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument()
  })

  it('al elegir una opción navega y se cierra', async () => {
    const { user } = renderizarPanel('ventas')
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.click(within(screen.getByRole('dialog', { name: 'Menú' })).getByRole('link', { name: /Pedidos/ }))

    expect(screen.getByText('Página Pedidos')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument()
  })
})

describe('PanelLayout: avisos sin leer', () => {
  it('muestra la cantidad de avisos sin leer en la campana', async () => {
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 7 })

    renderizarPanel('ventas')

    const campana = await screen.findByRole('link', { name: 'Avisos sin leer: 7' })
    expect(campana).toHaveTextContent('7')
    expect(campana).toHaveAttribute('href', '/panel#avisos')
  })

  it('con más de 99 avisos muestra "99+"', async () => {
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 150 })

    renderizarPanel('ventas')

    expect(await screen.findByRole('link', { name: 'Avisos sin leer: 150' })).toHaveTextContent('99+')
  })

  it('sin avisos no muestra contador', async () => {
    renderizarPanel('ventas')

    const campana = await screen.findByRole('link', { name: 'Avisos sin leer: 0' })
    expect(campana).not.toHaveTextContent(/\d/)
  })

  it('si falla la consulta, la pantalla sigue funcionando', async () => {
    vi.mocked(listarNotificaciones).mockRejectedValue(new Error('Sin conexión'))

    renderizarPanel('ventas')

    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalled())
    expect(screen.getByRole('link', { name: 'Avisos sin leer: 0' })).toBeInTheDocument()
    expect(screen.getByText('Página Resumen')).toBeInTheDocument()
  })

  it('vuelve a consultar los avisos cada minuto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderizarPanel('ventas')
    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalledTimes(1))
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 3 })

    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(listarNotificaciones).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('link', { name: 'Avisos sin leer: 3' })).toBeInTheDocument()
  })

  it('vuelve a consultar los avisos al cambiar de página', async () => {
    const { user } = renderizarPanel('ventas')
    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalledTimes(1))

    await user.click(within(menuLateral()).getByRole('link', { name: /Pedidos/ }))

    await waitFor(() => expect(listarNotificaciones).toHaveBeenCalledTimes(2))
  })
})
