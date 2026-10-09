import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Personal from './Personal'
import { actualizarUsuario, cambiarActivo, crearUsuario, listarPersonal } from '../../api/usuarios'
import { ErrorApi } from '../../api/cliente'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/usuarios', () => ({
  listarPersonal: vi.fn(),
  cambiarActivo: vi.fn(),
  crearUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
}))

const ana = { id: 'u1', nombre: 'Ana Pérez', email: 'ana@almacen.local', rol: 'ventas', telefono: null, activo: true }
const bruno = { id: 'u2', nombre: 'Bruno Díaz', email: 'bruno@almacen.local', rol: 'repartidor', telefono: null, activo: true }
const carla = { id: 'u3', nombre: 'Carla Ruiz', email: 'carla@almacen.local', rol: 'repartidor', telefono: null, activo: false }

function montar(usuarios = [ana, bruno, carla], incompleto = false) {
  vi.mocked(listarPersonal).mockResolvedValue({ usuarios, incompleto })
  return renderizar(<Personal />, { ruta: '/admin/personal', rol: 'superadmin' })
}

// La pantalla muestra cada usuario dos veces (tarjeta para móvil y fila de la tabla);
// las pruebas trabajan sobre la tabla de escritorio.
const tabla = () => screen.getByRole('table')
const fila = (nombre) => within(tabla()).getByRole('row', { name: new RegExp(nombre) })
const nombresEnTabla = () =>
  within(tabla())
    .getAllByRole('row')
    .slice(1)
    .map((f) => within(f).getAllByRole('cell')[0].textContent)

beforeEach(() => {
  vi.mocked(listarPersonal).mockReset()
  vi.mocked(cambiarActivo).mockReset()
  vi.mocked(crearUsuario).mockReset()
  vi.mocked(actualizarUsuario).mockReset()
})

describe('Personal: listado', () => {
  it('muestra el personal con su rol, estado y los totales', async () => {
    montar()

    await screen.findByRole('table')

    expect(nombresEnTabla()).toEqual(['Ana Pérez', 'Bruno Díaz', 'Carla Ruiz'])
    expect(within(fila('Ana Pérez')).getByText('Ventas')).toBeInTheDocument()
    expect(within(fila('Bruno Díaz')).getByText('Repartidor')).toBeInTheDocument()
    expect(within(fila('Carla Ruiz')).getByText('Inactivo')).toBeInTheDocument()
    expect(within(fila('Carla Ruiz')).getByRole('button', { name: 'Activar' })).toBeInTheDocument()
    expect(screen.getByText('3 en total · 2 activos')).toBeInTheDocument()
  })

  it('sin personal invita a crear la primera cuenta', async () => {
    montar([])

    expect(await screen.findByText('Todavía no hay vendedores ni repartidores.')).toBeInTheDocument()
  })

  it('avisa cuando la API devolvió solo las primeras 100 cuentas', async () => {
    montar([ana], true)

    expect(await screen.findByText(/solo se muestran las primeras 100/)).toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(listarPersonal)
      .mockRejectedValueOnce(new ErrorApi('No se pudo conectar con el servidor.', 0, null))
      .mockResolvedValueOnce({ usuarios: [ana], incompleto: false })
    const { user } = renderizar(<Personal />, { ruta: '/admin/personal', rol: 'superadmin' })

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(listarPersonal).toHaveBeenCalledTimes(2)
  })
})

describe('Personal: filtros', () => {
  it('filtra por rol', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(screen.getByRole('group', { name: 'Filtrar por rol' })).getByRole('button', { name: 'Repartidores' }))

    expect(nombresEnTabla()).toEqual(['Bruno Díaz', 'Carla Ruiz'])
  })

  it('filtra por estado', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(screen.getByRole('group', { name: 'Filtrar por estado' })).getByRole('button', { name: 'Inactivos' }))

    expect(nombresEnTabla()).toEqual(['Carla Ruiz'])
  })

  it('busca por nombre o correo sin distinguir mayúsculas', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Buscar por nombre o correo'), 'BRUNO@')

    expect(nombresEnTabla()).toEqual(['Bruno Díaz'])
  })

  it('si nadie coincide lo indica', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Buscar por nombre o correo'), 'zzz')

    expect(screen.getByText('Nadie coincide con la búsqueda.')).toBeInTheDocument()
  })
})

describe('Personal: crear y editar', () => {
  it('crea un usuario desde el modal y lo agrega a la lista en orden', async () => {
    vi.mocked(crearUsuario).mockResolvedValue({
      id: 'u4',
      nombre: 'Berta León',
      email: 'berta@almacen.local',
      rol: 'ventas',
      telefono: null,
      activo: true,
    })
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }))
    const modal = screen.getByRole('dialog', { name: 'Nuevo usuario' })
    await user.type(within(modal).getByLabelText('Nombre completo'), 'Berta León')
    await user.type(within(modal).getByLabelText('Correo (usuario para iniciar sesión)'), 'berta@almacen.local')
    await user.type(within(modal).getByLabelText('Contraseña'), 'Clave1234!')
    await user.click(within(modal).getByRole('radio', { name: /Ventas/ }))
    await user.click(within(modal).getByRole('button', { name: 'Crear usuario' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se creó la cuenta de Berta León.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(nombresEnTabla()).toEqual(['Ana Pérez', 'Berta León', 'Bruno Díaz', 'Carla Ruiz'])
  })

  it('edita un usuario existente con sus datos precargados', async () => {
    vi.mocked(actualizarUsuario).mockResolvedValue({ ...ana, nombre: 'Ana María Pérez' })
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Editar' }))
    const modal = screen.getByRole('dialog', { name: 'Editar usuario' })
    const nombre = within(modal).getByLabelText('Nombre completo')
    expect(nombre).toHaveValue('Ana Pérez')
    await user.clear(nombre)
    await user.type(nombre, 'Ana María Pérez')
    await user.click(within(modal).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se guardaron los cambios de Ana María Pérez.')
    expect(actualizarUsuario).toHaveBeenCalledWith('u1', expect.objectContaining({ nombre: 'Ana María Pérez' }))
    expect(nombresEnTabla()).toContain('Ana María Pérez')
  })

  it('el modal se cierra con "Cancelar" sin guardar', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearUsuario).not.toHaveBeenCalled()
  })
})

describe('Personal: activar y desactivar', () => {
  it('desactivar pide confirmación y, al confirmar, marca la cuenta como inactiva', async () => {
    vi.mocked(cambiarActivo).mockResolvedValue({ ...ana, activo: false })
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Desactivar' }))
    const confirmacion = screen.getByRole('dialog', { name: 'Desactivar cuenta' })
    expect(confirmacion).toHaveTextContent('Ana Pérez no podrá iniciar sesión')
    expect(cambiarActivo).not.toHaveBeenCalled()
    await user.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }))

    expect(cambiarActivo).toHaveBeenCalledWith('u1', false)
    expect(await screen.findByRole('status')).toHaveTextContent('Ana Pérez quedó inactivo.')
    expect(within(fila('Ana Pérez')).getByText('Inactivo')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar la confirmación no cambia nada', async () => {
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Desactivar' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(cambiarActivo).not.toHaveBeenCalled()
    expect(within(fila('Ana Pérez')).getByText('Activo')).toBeInTheDocument()
  })

  it('activar una cuenta inactiva se hace sin confirmación', async () => {
    vi.mocked(cambiarActivo).mockResolvedValue({ ...carla, activo: true })
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(fila('Carla Ruiz')).getByRole('button', { name: 'Activar' }))

    expect(cambiarActivo).toHaveBeenCalledWith('u3', true)
    expect(await screen.findByRole('status')).toHaveTextContent('Carla Ruiz quedó activo.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('si la API falla, muestra el error y la cuenta no cambia', async () => {
    vi.mocked(cambiarActivo).mockRejectedValue(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = montar()
    await screen.findByRole('table')

    await user.click(within(fila('Carla Ruiz')).getByRole('button', { name: 'Activar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('No tienes permiso para hacer esto.')
    expect(within(fila('Carla Ruiz')).getByText('Inactivo')).toBeInTheDocument()
  })
})
