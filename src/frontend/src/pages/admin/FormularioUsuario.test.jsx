import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormularioUsuario from './FormularioUsuario'
import { actualizarUsuario, crearUsuario } from '../../api/usuarios'
import { ErrorApi } from '../../api/cliente'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/usuarios', () => ({ crearUsuario: vi.fn(), actualizarUsuario: vi.fn() }))

const existente = {
  id: 'u1',
  nombre: 'Ana Pérez',
  email: 'ana@almacen.local',
  rol: 'ventas',
  telefono: '+584141234567',
  activo: true,
}

function montar(usuario = null) {
  const alGuardar = vi.fn()
  const alCancelar = vi.fn()
  const vista = renderizar(<FormularioUsuario usuario={usuario} alGuardar={alGuardar} alCancelar={alCancelar} />, {
    ruta: '/admin/personal',
    rol: 'superadmin',
  })
  return { ...vista, alGuardar, alCancelar }
}

const campoNombre = () => screen.getByLabelText('Nombre completo')
const campoCorreo = () => screen.getByLabelText('Correo (usuario para iniciar sesión)')
const campoClave = (nuevo = true) => screen.getByLabelText(nuevo ? 'Contraseña' : 'Nueva contraseña')

beforeEach(() => {
  vi.mocked(crearUsuario).mockReset()
  vi.mocked(actualizarUsuario).mockReset()
})

describe('FormularioUsuario: validaciones', () => {
  it('al crear con el formulario vacío muestra los errores de cada campo y no llama a la API', async () => {
    const { user } = montar()

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El correo es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('La contraseña es obligatoria.')).toBeInTheDocument()
    expect(screen.getByText('Elige un rol.')).toBeInTheDocument()
    expect(crearUsuario).not.toHaveBeenCalled()
  })

  it('rechaza un correo con formato inválido', async () => {
    const { user } = montar()
    await user.type(campoCorreo(), 'ana-sin-arroba')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(screen.getByText('El correo no tiene un formato válido.')).toBeInTheDocument()
  })

  it('exige entre 8 y 72 caracteres de contraseña', async () => {
    const { user } = montar()
    await user.type(campoClave(), 'corta')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(screen.getByText('La contraseña debe tener entre 8 y 72 caracteres.')).toBeInTheDocument()
  })

  it('al corregir un campo con error, el error desaparece', async () => {
    const { user } = montar()
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await user.type(campoNombre(), 'Ana')

    expect(screen.queryByText('El nombre es obligatorio.')).not.toBeInTheDocument()
    expect(screen.getByText('El correo es obligatorio.')).toBeInTheDocument()
  })
})

describe('FormularioUsuario: crear', () => {
  it('envía los datos normalizados y avisa con el usuario creado', async () => {
    const creado = { id: 'u9', nombre: 'Luis Gómez', email: 'luis@almacen.local', rol: 'repartidor', activo: true }
    vi.mocked(crearUsuario).mockResolvedValue(creado)
    const { user, alGuardar } = montar()
    await user.type(campoNombre(), '  Luis Gómez ')
    await user.type(campoCorreo(), ' luis@almacen.local ')
    await user.type(campoClave(), 'Clave1234!')
    await user.click(screen.getByRole('radio', { name: /Repartidor/ }))

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(crearUsuario).toHaveBeenCalledWith({
      nombre: 'Luis Gómez',
      email: 'luis@almacen.local',
      password: 'Clave1234!',
      rol: 'repartidor',
      telefono: null,
    })
    expect(alGuardar).toHaveBeenCalledWith(creado, true)
  })

  it('muestra "Mostrar" y "Ocultar" para ver la contraseña', async () => {
    const { user } = montar()
    expect(campoClave()).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar' }))

    expect(campoClave()).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument()
  })

  it('"Cancelar" no guarda y avisa al contenedor', async () => {
    const { user, alCancelar } = montar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(alCancelar).toHaveBeenCalledOnce()
    expect(crearUsuario).not.toHaveBeenCalled()
  })
})

describe('FormularioUsuario: editar', () => {
  it('precarga los datos y permite guardar sin cambiar la contraseña, conservando el teléfono', async () => {
    const actualizado = { ...existente, nombre: 'Ana María Pérez' }
    vi.mocked(actualizarUsuario).mockResolvedValue(actualizado)
    const { user, alGuardar } = montar(existente)
    expect(campoNombre()).toHaveValue('Ana Pérez')
    expect(campoCorreo()).toHaveValue('ana@almacen.local')
    expect(screen.getByRole('radio', { name: /Ventas/ })).toBeChecked()
    expect(screen.getByText('Déjala vacía para no cambiarla.')).toBeInTheDocument()

    await user.clear(campoNombre())
    await user.type(campoNombre(), 'Ana María Pérez')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizarUsuario).toHaveBeenCalledWith('u1', {
      nombre: 'Ana María Pérez',
      email: 'ana@almacen.local',
      password: '',
      rol: 'ventas',
      telefono: '+584141234567',
    })
    expect(alGuardar).toHaveBeenCalledWith(actualizado, false)
  })
})

describe('FormularioUsuario: errores de la API', () => {
  it('un 409 por correo repetido aparece debajo del correo', async () => {
    vi.mocked(actualizarUsuario).mockRejectedValue(new ErrorApi('Ya existe un usuario con ese correo.', 409, null))
    const { user, alGuardar } = montar(existente)

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const mensaje = await screen.findByText('Ya existe un usuario con ese correo.')
    expect(mensaje.previousElementSibling).toBe(campoCorreo())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('los errores de validación del servidor se muestran en su campo', async () => {
    vi.mocked(actualizarUsuario).mockRejectedValue(
      new ErrorApi('Datos inválidos', 400, { errors: { Nombre: ['El nombre es demasiado largo.'] } }),
    )
    const { user } = montar(existente)

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const mensaje = await screen.findByText('El nombre es demasiado largo.')
    expect(mensaje.previousElementSibling).toBe(campoNombre())
  })

  it('cualquier otro error aparece arriba del formulario', async () => {
    vi.mocked(actualizarUsuario).mockRejectedValue(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = montar(existente)

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para hacer esto.')
  })
})
