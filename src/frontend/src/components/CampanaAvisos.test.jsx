import { screen, waitFor, within } from '@testing-library/react'
import { Link, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampanaAvisos from './CampanaAvisos'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../api/notificaciones'
import { EVENTO_AVISOS, avisarCambioAvisos } from '../utils/avisos'
import { renderizar } from '../test/renderizar'

vi.mock('../api/notificaciones', () => ({
  listarNotificaciones: vi.fn(),
  marcarLeida: vi.fn(),
  marcarTodasLeidas: vi.fn(),
}))

const AVISOS = {
  items: [
    { id: 'a1', tipo: 'stock_agotado', producto: 'Harina PAN', creadoEn: '2026-10-15T14:00:00Z' },
    { id: 'a2', tipo: 'pedido_nuevo', creadoEn: '2026-10-15T15:30:00Z' },
  ],
  total: 2,
}

// La campana en una página cualquiera del panel (no en el Resumen), con un enlace a otra página.
function Pagina() {
  return (
    <Routes>
      <Route
        path="/admin/cupones"
        element={
          <>
            <CampanaAvisos />
            <p>Página Cupones</p>
            <Link to="/admin/personal">Ir a Personal</Link>
          </>
        }
      />
      <Route path="/admin/personal" element={<CampanaAvisos />} />
    </Routes>
  )
}

const renderizarCampana = () => renderizar(<Pagina />, { ruta: '/admin/cupones', patron: '*', rol: 'superadmin' })
const abrir = async (user, total = 2) => user.click(await screen.findByRole('button', { name: `Avisos sin leer: ${total}` }))

beforeEach(() => {
  vi.mocked(listarNotificaciones).mockReset().mockResolvedValue(AVISOS)
  vi.mocked(marcarLeida).mockReset().mockResolvedValue(null)
  vi.mocked(marcarTodasLeidas).mockReset().mockResolvedValue(null)
})

describe('CampanaAvisos', () => {
  it('abre la lista de avisos en la misma página, sin navegar', async () => {
    const { user } = renderizarCampana()

    await abrir(user)

    const lista = screen.getByRole('dialog', { name: 'Avisos' })
    expect(within(lista).getByText(/Se agotó Harina PAN/)).toBeInTheDocument()
    expect(within(lista).getByText(/Llegó un pedido nuevo/)).toBeInTheDocument()
    expect(screen.getByText('Página Cupones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avisos sin leer: 2' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('marca un aviso como leído, lo quita de la lista y baja el contador', async () => {
    const { user } = renderizarCampana()
    await abrir(user)
    // Lo que devolverá la API al recargar, ya sin el aviso leído.
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [AVISOS.items[1]], total: 1 })

    await user.click(within(screen.getByText(/Se agotó Harina PAN/).closest('li')).getByRole('button', { name: 'Leído' }))

    expect(marcarLeida).toHaveBeenCalledWith('a1')
    expect(screen.queryByText(/Se agotó Harina PAN/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avisos sin leer: 1' })).toBeInTheDocument()
  })

  it('marca todos como leídos', async () => {
    const { user } = renderizarCampana()
    await abrir(user)
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 0 })

    await user.click(screen.getByRole('button', { name: 'Marcar todos como leídos' }))

    expect(marcarTodasLeidas).toHaveBeenCalled()
    expect(within(screen.getByRole('dialog', { name: 'Avisos' })).getByText('No hay avisos sin leer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avisos sin leer: 0' })).toBeInTheDocument()
  })

  it('al marcar avisos avisa al resto de la pantalla (p. ej. al Resumen)', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_AVISOS, escucha)
    const { user } = renderizarCampana()
    await abrir(user)

    await user.click(screen.getAllByRole('button', { name: 'Leído' })[0])

    await waitFor(() => expect(escucha).toHaveBeenCalled())
    window.removeEventListener(EVENTO_AVISOS, escucha)
  })

  it('se actualiza cuando otra parte de la pantalla marca avisos', async () => {
    renderizarCampana()
    await screen.findByRole('button', { name: 'Avisos sin leer: 2' })
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 0 })

    avisarCambioAvisos()

    expect(await screen.findByRole('button', { name: 'Avisos sin leer: 0' })).toBeInTheDocument()
  })

  it('se cierra con Escape y al hacer clic fuera', async () => {
    const { user } = renderizarCampana()
    await abrir(user)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Avisos' })).not.toBeInTheDocument()

    await abrir(user)
    await user.click(screen.getByText('Página Cupones'))
    expect(screen.queryByRole('dialog', { name: 'Avisos' })).not.toBeInTheDocument()
  })

  it('se cierra al cambiar de página', async () => {
    const { user } = renderizarCampana()
    await abrir(user)

    await user.click(screen.getByRole('link', { name: 'Ir a Personal' }))

    expect(screen.queryByRole('dialog', { name: 'Avisos' })).not.toBeInTheDocument()
  })

  it('sin avisos lo dice, y ofrece ir al resumen del día', async () => {
    vi.mocked(listarNotificaciones).mockResolvedValue({ items: [], total: 0 })
    const { user } = renderizarCampana()

    await abrir(user, 0)

    const lista = screen.getByRole('dialog', { name: 'Avisos' })
    expect(within(lista).getByText('No hay avisos sin leer.')).toBeInTheDocument()
    expect(within(lista).queryByRole('button', { name: 'Marcar todos como leídos' })).not.toBeInTheDocument()
    expect(within(lista).getByRole('link', { name: /Ir al resumen del día/ })).toHaveAttribute('href', '/panel')
  })

  it('si no se pueden cargar los avisos lo indica en la lista', async () => {
    vi.mocked(listarNotificaciones).mockRejectedValue(new Error('Sin conexión'))
    const { user } = renderizarCampana()

    await abrir(user, 0)

    expect(await screen.findByText('No se pudieron cargar los avisos.')).toBeInTheDocument()
  })
})
