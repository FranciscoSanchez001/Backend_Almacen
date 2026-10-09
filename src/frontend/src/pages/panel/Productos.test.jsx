import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Productos from './Productos'
import {
  actualizarProducto,
  borrarProducto,
  crearCategoria,
  crearProducto,
  listarCategorias,
  listarProductos,
  renombrarCategoria,
} from '../../api/productos'
import { ErrorApi } from '../../api/cliente'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/productos', () => ({
  listarProductos: vi.fn(),
  listarCategorias: vi.fn(),
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  borrarProducto: vi.fn(),
  crearCategoria: vi.fn(),
  renombrarCategoria: vi.fn(),
}))

const categorias = [
  { id: 'c1', nombre: 'Víveres' },
  { id: 'c2', nombre: 'Bebidas' },
]

const arroz = {
  id: 'p1',
  codigoSku: 'VIV-0001',
  nombre: 'Arroz',
  descripcion: null,
  precioUsd: 1.5,
  costoUsd: 1,
  imagenUrl: null,
  categoriaId: 'c1',
  categoria: 'Víveres',
  stockDisponible: 10,
  stockMinimo: 5,
  stockMaximo: 100,
  ubicacion: null,
  unidadMedida: 'unidad',
  activo: true,
  bajoStockMinimo: false,
}
const refresco = { ...arroz, id: 'p2', codigoSku: 'BEB-0001', nombre: 'Refresco', categoriaId: 'c2', categoria: 'Bebidas', precioUsd: 2 }
const borrado = { ...arroz, id: 'p3', codigoSku: 'VIV-0099', nombre: 'Avena', activo: false }

function montar(rol = 'superadmin') {
  return renderizar(<Productos />, { ruta: '/panel/productos', rol })
}

beforeEach(() => {
  vi.mocked(listarProductos).mockReset().mockResolvedValue(pagina([arroz, refresco]))
  vi.mocked(listarCategorias).mockReset().mockResolvedValue(categorias)
  for (const f of [crearProducto, actualizarProducto, borrarProducto, crearCategoria, renombrarCategoria]) vi.mocked(f).mockReset()
})

describe('Productos: listado y filtros', () => {
  it('lista los productos con su SKU, categoría, precio y total', async () => {
    montar()

    const fila = (await screen.findByText('Arroz')).closest('tr')
    expect(within(fila).getByText('VIV-0001')).toBeInTheDocument()
    expect(within(fila).getByText('Víveres')).toBeInTheDocument()
    expect(within(fila).getByText('$1.50')).toBeInTheDocument()
    expect(screen.getByText('Refresco')).toBeInTheDocument()
    expect(screen.getByText('2 productos')).toBeInTheDocument()
    expect(listarProductos).toHaveBeenCalledWith({ q: '', categoriaId: '', incluirInactivos: undefined, pagina: 1, tamano: 25 })
  })

  it('sin resultados muestra el mensaje de lista vacía', async () => {
    vi.mocked(listarProductos).mockResolvedValue(pagina([]))

    montar()

    expect(await screen.findByText('No hay productos que coincidan.')).toBeInTheDocument()
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(listarProductos).mockRejectedValueOnce(new ErrorApi('El servicio no está disponible en este momento.', 503, null))
    const { user } = montar()

    expect(await screen.findByText('El servicio no está disponible en este momento.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Arroz')).toBeInTheDocument()
  })

  it('busca por texto después de dejar de escribir', async () => {
    const { user } = montar()
    await screen.findByText('Arroz')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), ' arroz ')

    await waitFor(() => expect(listarProductos).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'arroz', pagina: 1 })), {
      timeout: 2000,
    })
  })

  it('filtra por categoría', async () => {
    const { user } = montar()
    await screen.findByRole('option', { name: 'Bebidas' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por categoría' }), 'c2')

    await waitFor(() => expect(listarProductos).toHaveBeenLastCalledWith(expect.objectContaining({ categoriaId: 'c2', pagina: 1 })))
  })

  it('el gerente puede incluir los productos borrados, que se muestran sin acciones', async () => {
    const { user } = montar('superadmin')
    await screen.findByText('Arroz')
    vi.mocked(listarProductos).mockResolvedValue(pagina([arroz, borrado]))

    await user.click(screen.getByRole('checkbox', { name: 'Mostrar borrados' }))

    await waitFor(() => expect(listarProductos).toHaveBeenLastCalledWith(expect.objectContaining({ incluirInactivos: true })))
    const fila = (await screen.findByText('(borrado)')).closest('tr')
    expect(within(fila).queryByRole('button')).not.toBeInTheDocument()
  })

  it('pagina los resultados cuando hay más de 25 productos', async () => {
    vi.mocked(listarProductos).mockResolvedValue(pagina([arroz], { total: 60 }))
    const { user } = montar()
    const siguiente = await screen.findByRole('button', { name: 'Siguiente →' })
    // La búsqueda con espera también corre al montar y, a los 500 ms, vuelve a la página 1.
    // Se espera a que pase para que no deshaga el cambio de página.
    await new Promise((listo) => setTimeout(listo, 600))

    await user.click(siguiente)

    await waitFor(() => expect(listarProductos).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 })))
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
  })
})

describe('Productos: permisos por rol', () => {
  it('ventas puede editar pero no ve Eliminar ni Mostrar borrados', async () => {
    montar('ventas')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    expect(within(fila).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Mostrar borrados' })).not.toBeInTheDocument()
  })

  it('el gerente ve Editar y Eliminar en cada producto activo', async () => {
    montar('superadmin')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    expect(within(fila).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })
})

describe('Productos: creación y edición', () => {
  it('crea un producto desde el modal, muestra el aviso y recarga la lista', async () => {
    vi.mocked(crearProducto).mockResolvedValue({ ...arroz, id: 'p9', nombre: 'Harina' })
    const { user } = montar()
    await screen.findByText('Arroz')

    await user.click(screen.getByRole('button', { name: '+ Nuevo producto' }))
    const modal = screen.getByRole('dialog', { name: 'Nuevo producto' })
    await user.type(within(modal).getByLabelText('Código SKU'), 'VIV-0010')
    await user.type(within(modal).getByLabelText('Nombre'), 'Harina')
    await user.type(within(modal).getByLabelText('Precio de venta (USD)'), '2')
    await user.type(within(modal).getByLabelText('Costo (USD)'), '1')
    await user.selectOptions(within(modal).getByLabelText('Categoría'), 'c1')
    await user.type(within(modal).getByLabelText('Stock inicial'), '10')
    const llamadasAntes = vi.mocked(listarProductos).mock.calls.length
    await user.click(within(modal).getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se creó Harina.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearProducto).toHaveBeenCalledWith(expect.objectContaining({ codigoSku: 'VIV-0010', stockInicial: 10 }))
    await waitFor(() => expect(vi.mocked(listarProductos).mock.calls.length).toBeGreaterThan(llamadasAntes))
  })

  it('un SKU repetido (409) se muestra en el campo y el modal sigue abierto', async () => {
    vi.mocked(crearProducto).mockRejectedValue(new ErrorApi('Ya existe un producto con el SKU VIV-0001.', 409, null))
    const { user } = montar()
    await screen.findByText('Arroz')

    await user.click(screen.getByRole('button', { name: '+ Nuevo producto' }))
    const modal = screen.getByRole('dialog', { name: 'Nuevo producto' })
    await user.type(within(modal).getByLabelText('Código SKU'), 'VIV-0001')
    await user.type(within(modal).getByLabelText('Nombre'), 'Arroz')
    await user.type(within(modal).getByLabelText('Precio de venta (USD)'), '2')
    await user.type(within(modal).getByLabelText('Costo (USD)'), '1')
    await user.selectOptions(within(modal).getByLabelText('Categoría'), 'c1')
    await user.type(within(modal).getByLabelText('Stock inicial'), '10')
    await user.click(within(modal).getByRole('button', { name: 'Crear producto' }))

    expect(await within(modal).findByText('Ya existe un producto con el SKU VIV-0001.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('edita un producto con sus datos cargados', async () => {
    vi.mocked(actualizarProducto).mockResolvedValue({ ...arroz, nombre: 'Arroz integral' })
    const { user } = montar('ventas')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    const modal = screen.getByRole('dialog', { name: 'Editar producto' })
    expect(within(modal).getByLabelText('Código SKU')).toHaveValue('VIV-0001')
    await user.clear(within(modal).getByLabelText('Nombre'))
    await user.type(within(modal).getByLabelText('Nombre'), 'Arroz integral')
    await user.click(within(modal).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se guardaron los cambios de Arroz integral.')
    expect(actualizarProducto).toHaveBeenCalledWith('p1', expect.objectContaining({ nombre: 'Arroz integral' }))
  })

  it('Cancelar cierra el modal sin guardar', async () => {
    const { user } = montar()
    await screen.findByText('Arroz')

    await user.click(screen.getByRole('button', { name: '+ Nuevo producto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(crearProducto).not.toHaveBeenCalled()
  })
})

describe('Productos: borrado', () => {
  it('pide confirmación y borra el producto', async () => {
    vi.mocked(borrarProducto).mockResolvedValue(null)
    const { user } = montar('superadmin')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    const modal = screen.getByRole('dialog', { name: 'Eliminar producto' })
    expect(modal).toHaveTextContent('Arroz dejará de aparecer en la tienda')
    expect(borrarProducto).not.toHaveBeenCalled()
    await user.click(within(modal).getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Arroz se quitó del catálogo.')
    expect(borrarProducto).toHaveBeenCalledWith('p1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar la confirmación no borra nada', async () => {
    const { user } = montar('superadmin')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(borrarProducto).not.toHaveBeenCalled()
  })

  it('si la API rechaza el borrado muestra el error', async () => {
    vi.mocked(borrarProducto).mockRejectedValue(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = montar('superadmin')
    const fila = (await screen.findByText('Arroz')).closest('tr')

    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('No tienes permiso para hacer esto.')
  })
})

describe('Productos: categorías', () => {
  it('ventas ve las categorías pero no puede crearlas ni renombrarlas', async () => {
    const { user } = montar('ventas')
    await screen.findByText('Arroz')

    await user.click(screen.getByRole('button', { name: 'Categorías' }))
    const modal = screen.getByRole('dialog', { name: 'Categorías' })

    expect(within(modal).getByText('Víveres')).toBeInTheDocument()
    expect(within(modal).getByText('Solo el gerente puede crear o renombrar categorías.')).toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Renombrar' })).not.toBeInTheDocument()
    expect(within(modal).queryByRole('textbox', { name: 'Nombre de la nueva categoría' })).not.toBeInTheDocument()
  })

  it('el gerente crea una categoría y la lista se recarga', async () => {
    vi.mocked(crearCategoria).mockResolvedValue({ id: 'c3', nombre: 'Limpieza' })
    const { user } = montar('superadmin')
    await screen.findByText('Arroz')
    await user.click(screen.getByRole('button', { name: 'Categorías' }))
    const modal = screen.getByRole('dialog', { name: 'Categorías' })
    expect(within(modal).getByRole('button', { name: 'Agregar' })).toBeDisabled()
    vi.mocked(listarCategorias).mockResolvedValue([...categorias, { id: 'c3', nombre: 'Limpieza' }])

    await user.type(within(modal).getByRole('textbox', { name: 'Nombre de la nueva categoría' }), '  Limpieza ')
    await user.click(within(modal).getByRole('button', { name: 'Agregar' }))

    expect(crearCategoria).toHaveBeenCalledWith('Limpieza')
    expect(await within(modal).findByText('Limpieza')).toBeInTheDocument()
    expect(within(modal).getByRole('textbox', { name: 'Nombre de la nueva categoría' })).toHaveValue('')
  })

  it('el gerente renombra una categoría', async () => {
    vi.mocked(renombrarCategoria).mockResolvedValue(null)
    const { user } = montar('superadmin')
    await screen.findByText('Arroz')
    await user.click(screen.getByRole('button', { name: 'Categorías' }))
    const modal = screen.getByRole('dialog', { name: 'Categorías' })

    await user.click(within(modal).getAllByRole('button', { name: 'Renombrar' })[1])
    const campo = within(modal).getByRole('textbox', { name: 'Nuevo nombre' })
    await user.clear(campo)
    await user.type(campo, 'Bebidas y jugos')
    await user.click(within(modal).getByRole('button', { name: 'Guardar' }))

    expect(renombrarCategoria).toHaveBeenCalledWith('c2', 'Bebidas y jugos')
    await waitFor(() => expect(within(modal).queryByRole('textbox', { name: 'Nuevo nombre' })).not.toBeInTheDocument())
  })

  it('muestra el error de la API al crear una categoría repetida', async () => {
    vi.mocked(crearCategoria).mockRejectedValue(new ErrorApi('Ya existe una categoría con ese nombre.', 409, null))
    const { user } = montar('superadmin')
    await screen.findByText('Arroz')
    await user.click(screen.getByRole('button', { name: 'Categorías' }))
    const modal = screen.getByRole('dialog', { name: 'Categorías' })

    await user.type(within(modal).getByRole('textbox', { name: 'Nombre de la nueva categoría' }), 'Bebidas')
    await user.click(within(modal).getByRole('button', { name: 'Agregar' }))

    expect(await within(modal).findByRole('alert')).toHaveTextContent('Ya existe una categoría con ese nombre.')
  })
})
