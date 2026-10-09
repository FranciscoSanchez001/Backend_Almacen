import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormularioProducto from './FormularioProducto'
import { actualizarProducto, crearProducto } from '../../api/productos'
import { ErrorApi } from '../../api/cliente'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/productos', () => ({ crearProducto: vi.fn(), actualizarProducto: vi.fn() }))

const categorias = [
  { id: 'c1', nombre: 'Víveres' },
  { id: 'c2', nombre: 'Bebidas' },
]

const existente = {
  id: 'p1',
  codigoSku: 'VIV-0001',
  nombre: 'Arroz',
  descripcion: 'Arroz blanco',
  precioUsd: 1.5,
  costoUsd: 1,
  imagenUrl: null,
  categoriaId: 'c1',
  stockDisponible: 10,
  stockMinimo: 5,
  stockMaximo: 100,
  ubicacion: 'P1-E1',
  unidadMedida: 'kg',
}

function montar(producto) {
  const alGuardar = vi.fn()
  const alCancelar = vi.fn()
  const r = renderizar(
    <FormularioProducto producto={producto} categorias={categorias} alGuardar={alGuardar} alCancelar={alCancelar} />,
    { ruta: '/panel/productos', rol: 'superadmin' },
  )
  return { ...r, alGuardar, alCancelar }
}

// Llena los campos obligatorios de un producto nuevo válido.
async function llenarNuevo(user) {
  await user.type(screen.getByLabelText('Código SKU'), '  viv-0010 ')
  await user.type(screen.getByLabelText('Nombre'), ' Harina de maíz ')
  await user.type(screen.getByLabelText('Precio de venta (USD)'), '2.5')
  await user.type(screen.getByLabelText('Costo (USD)'), '1.75')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'c2')
  await user.type(screen.getByLabelText('Stock inicial'), '20')
}

beforeEach(() => {
  vi.mocked(crearProducto).mockReset()
  vi.mocked(actualizarProducto).mockReset()
})

describe('FormularioProducto: validaciones', () => {
  it('con el formulario vacío muestra los errores de los campos obligatorios y no llama a la API', async () => {
    const { user } = montar()

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(screen.getByText('El código SKU es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El precio debe ser mayor que 0.')).toBeInTheDocument()
    expect(screen.getByText('El costo debe ser mayor que 0.')).toBeInTheDocument()
    expect(screen.getByText('Elige una categoría.')).toBeInTheDocument()
    expect(screen.getByText('El stock no puede estar vacío ni ser negativo.')).toBeInTheDocument()
    expect(crearProducto).not.toHaveBeenCalled()
  })

  it('rechaza un SKU con caracteres no permitidos', async () => {
    const { user } = montar()
    await llenarNuevo(user)
    await user.clear(screen.getByLabelText('Código SKU'))
    await user.type(screen.getByLabelText('Código SKU'), 'VIV 0010')

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(screen.getByText('Solo letras, números y guiones.')).toBeInTheDocument()
    expect(crearProducto).not.toHaveBeenCalled()
  })

  it('exige que el stock máximo sea mayor que el mínimo', async () => {
    const { user } = montar()
    await llenarNuevo(user)
    await user.clear(screen.getByLabelText('Stock máximo'))
    await user.type(screen.getByLabelText('Stock máximo'), '5')

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(screen.getByText('Debe ser mayor que el stock mínimo.')).toBeInTheDocument()
    expect(crearProducto).not.toHaveBeenCalled()
  })

  it('exige que la URL de la imagen empiece por http:// o https://', async () => {
    const { user } = montar()
    await llenarNuevo(user)
    await user.type(screen.getByLabelText('URL de la imagen (opcional)'), 'ftp://imagen.png')

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(screen.getByText('Debe empezar por http:// o https://')).toBeInTheDocument()
    expect(crearProducto).not.toHaveBeenCalled()
  })

  it('el error de un campo desaparece al corregirlo', async () => {
    const { user } = montar()
    await user.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nombre'), 'Arroz')

    expect(screen.queryByText('El nombre es obligatorio.')).not.toBeInTheDocument()
  })

  it('muestra el margen calculado a partir del precio y el costo', async () => {
    const { user } = montar()

    await user.type(screen.getByLabelText('Precio de venta (USD)'), '2')
    await user.type(screen.getByLabelText('Costo (USD)'), '1.5')

    expect(screen.getByText('Margen: 25 %')).toBeInTheDocument()
  })
})

describe('FormularioProducto: creación', () => {
  it('envía los datos normalizados con números y opcionales vacíos como null', async () => {
    const guardado = { id: 'nuevo' }
    vi.mocked(crearProducto).mockResolvedValue(guardado)
    const { user, alGuardar } = montar()
    await llenarNuevo(user)

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(guardado, true))
    expect(crearProducto).toHaveBeenCalledWith({
      codigoSku: 'viv-0010',
      nombre: 'Harina de maíz',
      descripcion: null,
      precioUsd: 2.5,
      costoUsd: 1.75,
      imagenUrl: null,
      categoriaId: 'c2',
      stockMinimo: 5,
      stockMaximo: 100,
      ubicacion: null,
      unidadMedida: 'unidad',
      stockInicial: 20,
    })
    expect(actualizarProducto).not.toHaveBeenCalled()
  })

  it('un 409 de la API (SKU repetido) se muestra debajo del código SKU', async () => {
    vi.mocked(crearProducto).mockRejectedValue(new ErrorApi('Ya existe un producto con el SKU VIV-0010.', 409, null))
    const { user, alGuardar } = montar()
    await llenarNuevo(user)

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Ya existe un producto con el SKU VIV-0010.')).toBeInTheDocument()
    expect(alGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Crear producto' })).toBeEnabled()
  })

  it('los errores de validación de la API aparecen en su campo', async () => {
    vi.mocked(crearProducto).mockRejectedValue(
      new ErrorApi('Datos inválidos', 400, { errors: { Nombre: ['El nombre es demasiado largo.'] } }),
    )
    const { user } = montar()
    await llenarNuevo(user)

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('El nombre es demasiado largo.')).toBeInTheDocument()
  })

  it('un error sin detalle por campo se muestra como alerta general', async () => {
    vi.mocked(crearProducto).mockRejectedValue(new ErrorApi('No se pudo conectar con el servidor.', 0, null))
    const { user } = montar()
    await llenarNuevo(user)

    await user.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })

  it('Cancelar avisa al contenedor sin guardar', async () => {
    const { user, alCancelar } = montar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(alCancelar).toHaveBeenCalledOnce()
    expect(crearProducto).not.toHaveBeenCalled()
  })
})

describe('FormularioProducto: edición', () => {
  it('carga los datos del producto y muestra el stock disponible en lugar del inicial', () => {
    montar(existente)

    expect(screen.getByLabelText('Código SKU')).toHaveValue('VIV-0001')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Arroz')
    expect(screen.getByLabelText('Categoría')).toHaveValue('c1')
    expect(screen.getByLabelText('Stock disponible')).toHaveValue(10)
    expect(screen.queryByLabelText('Stock inicial')).not.toBeInTheDocument()
    expect(screen.getByText('Si lo cambias, queda como ajuste.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('guarda con actualizarProducto y envía stockDisponible', async () => {
    const guardado = { ...existente, nombre: 'Arroz integral' }
    vi.mocked(actualizarProducto).mockResolvedValue(guardado)
    const { user, alGuardar } = montar(existente)
    await user.clear(screen.getByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'Arroz integral')
    await user.clear(screen.getByLabelText('Stock disponible'))
    await user.type(screen.getByLabelText('Stock disponible'), '4')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(guardado, false))
    const [id, cuerpo] = vi.mocked(actualizarProducto).mock.calls[0]
    expect(id).toBe('p1')
    expect(cuerpo).toMatchObject({ nombre: 'Arroz integral', stockDisponible: 4, descripcion: 'Arroz blanco', ubicacion: 'P1-E1', unidadMedida: 'kg' })
    expect(cuerpo).not.toHaveProperty('stockInicial')
    expect(crearProducto).not.toHaveBeenCalled()
  })
})
