import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TiendaLayout from '../layouts/TiendaLayout'
import { renderizar } from '../test/renderizar'
import { crearToken } from '../test/jwt'
import { listarCategorias } from '../api/catalogo'
import { cargarGoogle } from '../api/google'

vi.mock('../api/catalogo', () => ({ listarCategorias: vi.fn() }))
vi.mock('../api/google', async (original) => ({ ...await original(), cargarGoogle: vi.fn() }))

let recibir
let google
let fetchSimulado
const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status: estado, headers: { 'Content-Type': 'application/json' },
})

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente-pruebas')
  vi.mocked(listarCategorias).mockResolvedValue([])
  google = {
    initialize: vi.fn((opciones) => { recibir = opciones.callback }),
    renderButton: vi.fn((elemento) => {
      const boton = document.createElement('button')
      boton.textContent = 'Continuar con Google'
      boton.onclick = () => recibir({ credential: 'id-token-google' })
      elemento.append(boton)
    }),
    disableAutoSelect: vi.fn(),
  }
  vi.stubGlobal('google', { accounts: { id: google } })
  vi.mocked(cargarGoogle).mockReset().mockResolvedValue(google)
  fetchSimulado = vi.fn()
  vi.stubGlobal('fetch', fetchSimulado)
})

afterEach(() => vi.unstubAllEnvs())

async function abrir() {
  const vista = renderizar(<TiendaLayout />)
  await vista.user.click(screen.getByRole('button', { name: 'Ingresar' }))
  return vista
}

describe('Acceso de clientes desde la tienda', () => {
  it('abre el diálogo, permite cerrar y conserva el acceso independiente del personal', async () => {
    const { user } = await abrir()
    expect(screen.getByRole('dialog', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acceso del personal' })).toHaveAttribute('href', '/internal-login')
    await user.click(screen.getByRole('button', { name: 'Cerrar acceso de clientes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toHaveFocus()
  })

  it('ingresa, recupera la sesión al recargar y la revoca al salir', async () => {
    fetchSimulado.mockResolvedValueOnce(json(200, {
      token: crearToken({ rol: 'cliente', nombre: 'Ana Cliente' }), refreshToken: 'refresh-cliente',
    }))
    const { user, unmount } = await abrir()
    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))
    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mi panel' })).not.toBeInTheDocument()
    expect(JSON.parse(fetchSimulado.mock.calls[0][1].body)).toEqual({ idToken: 'id-token-google' })
    unmount()
    const recarga = renderizar(<TiendaLayout />)
    expect(screen.getByText('Ana Cliente')).toBeInTheDocument()
    fetchSimulado.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await recarga.user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(fetchSimulado.mock.calls[1][0].pathname).toBe('/auth/logout')
    expect(localStorage.getItem('almacen.token')).toBeNull()
    expect(localStorage.getItem('almacen.refresh')).toBeNull()
    expect(google.disableAutoSelect).toHaveBeenCalledOnce()
  })

  it('muestra el error del backend y permite volver a intentar', async () => {
    fetchSimulado.mockResolvedValueOnce(json(409, { mensaje: 'Ese correo pertenece al personal.' }))
    const { user } = await abrir()
    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese correo pertenece al personal.')
    expect(localStorage.getItem('almacen.token')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('informa cuando Google no carga y reintenta la carga', async () => {
    vi.mocked(cargarGoogle).mockRejectedValueOnce(new Error('No se pudo cargar Google.'))
    const { user } = await abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Google.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('sin configuración muestra un mensaje y no carga el SDK', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    await abrir()
    expect(screen.getByRole('alert')).toHaveTextContent('El acceso con Google no está disponible')
    expect(cargarGoogle).not.toHaveBeenCalled()
  })

  it('ignora una credencial recibida después de cerrar el diálogo', async () => {
    const { user } = await abrir()
    await screen.findByRole('button', { name: 'Continuar con Google' })
    await user.click(screen.getByRole('button', { name: 'Cerrar acceso de clientes' }))
    recibir({ credential: 'tardio' })
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('evita solicitudes duplicadas mientras está ingresando y permite cerrar con Escape al terminar', async () => {
    let rechazar
    fetchSimulado.mockReturnValue(new Promise((_, reject) => { rechazar = reject }))
    const { user } = await abrir()
    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))
    recibir({ credential: 'duplicado' })
    expect(fetchSimulado).toHaveBeenCalledOnce()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rechazar(new Error('Sin conexión'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar'))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
