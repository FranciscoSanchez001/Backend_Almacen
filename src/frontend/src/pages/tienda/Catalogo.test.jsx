import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Catalogo from './Catalogo'
import TiendaLayout from '../../layouts/TiendaLayout'
import { AuthProvider } from '../../context/AuthContext'
import { CarritoProvider } from '../../context/CarritoContext'
import { ThemeProvider } from '../../context/ThemeContext'
import { listarCatalogo, listarCategorias } from '../../api/catalogo'

vi.mock('../../api/catalogo', () => ({ listarCatalogo: vi.fn(), listarCategorias: vi.fn() }))

const CATEGORIAS = [
  { id: 'c1', nombre: 'Víveres' },
  { id: 'c2', nombre: 'Bebidas' },
]

const producto = (id, nombre, extra = {}) => ({
  id,
  nombre,
  categoria: 'Víveres',
  unidadMedida: 'unidad',
  precioUsd: 1.5,
  precioBs: 60,
  stockDisponible: 20,
  imagenUrl: null,
  ...extra,
})

const resultado = (items, total = items.length) => ({ items, total, numeroPagina: 1, tamano: 24 })

// Muestra la búsqueda actual, para comprobar los cambios de página en la URL.
function Busqueda() {
  const { search } = useLocation()
  return <p data-testid="busqueda">{search}</p>
}

// El catálogo recibe las categorías del layout de la tienda (Outlet context), así que se monta dentro de él.
function renderizarTienda(ruta = '/') {
  const user = userEvent.setup()
  render(
    <ThemeProvider>
      <AuthProvider>
        <CarritoProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              <Route element={<TiendaLayout />}>
                <Route index element={<><Catalogo /><Busqueda /></>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CarritoProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
  return { user }
}

beforeEach(() => {
  vi.mocked(listarCategorias).mockReset().mockResolvedValue(CATEGORIAS)
  vi.mocked(listarCatalogo).mockReset()
})

describe('Catalogo: listado', () => {
  it('muestra la bienvenida y los productos sin filtros', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz'), producto('p2', 'Harina')]))

    renderizarTienda()

    expect(await screen.findByRole('heading', { name: 'Arroz' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Harina' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Todos los productos' })).toBeInTheDocument()
    expect(screen.getByText('Haz tu compra y te la llevamos')).toBeInTheDocument()
    expect(screen.getByText('2 productos')).toBeInTheDocument()
    expect(listarCatalogo).toHaveBeenCalledWith({ q: '', categoriaId: '', pagina: 1, tamano: 24 })
  })

  it('usa el singular con un solo producto', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')]))

    renderizarTienda()

    expect(await screen.findByText('1 producto')).toBeInTheDocument()
  })

  it('avisa cuando no hay productos', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([]))

    renderizarTienda('/?q=caviar')

    expect(await screen.findByText('No encontramos productos')).toBeInTheDocument()
  })
})

describe('Catalogo: filtros por URL', () => {
  it('busca por texto con ?q y muestra el título de resultados', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Harina de maíz')]))

    renderizarTienda('/?q=harina')

    expect(await screen.findByRole('heading', { name: 'Resultados para “harina”' })).toBeInTheDocument()
    expect(listarCatalogo).toHaveBeenCalledWith(expect.objectContaining({ q: 'harina', categoriaId: '' }))
    expect(screen.queryByText('Haz tu compra y te la llevamos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quitar filtros' })).toHaveAttribute('href', '/')
  })

  it('filtra por categoría con ?categoria y muestra su nombre', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p3', 'Malta', { categoria: 'Bebidas' })]))

    renderizarTienda('/?categoria=c2')

    expect(await screen.findByRole('heading', { name: 'Bebidas', level: 1 })).toBeInTheDocument()
    expect(listarCatalogo).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'c2' }))
  })

  it('el buscador del encabezado vuelve a consultar con el texto escrito', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')]))
    const { user } = renderizarTienda()
    await screen.findByRole('heading', { name: 'Arroz' })

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), '  café ')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(listarCatalogo).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'café' })))
    expect(await screen.findByRole('heading', { name: 'Resultados para “café”' })).toBeInTheDocument()
  })

  it('la barra de categorías filtra el catálogo', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')]))
    const { user } = renderizarTienda()
    const categorias = screen.getByRole('navigation', { name: 'Categorías' })

    await user.click(await within(categorias).findByRole('link', { name: 'Bebidas' }))

    await waitFor(() => expect(listarCatalogo).toHaveBeenLastCalledWith(expect.objectContaining({ categoriaId: 'c2' })))
  })
})

describe('Catalogo: paginación', () => {
  it('muestra la paginación cuando hay más de una página y avanza con ?pagina', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')], 50))
    const { user } = renderizarTienda()

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Siguiente →' }))

    expect(screen.getByTestId('busqueda')).toHaveTextContent('?pagina=2')
    await waitFor(() => expect(listarCatalogo).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 })))
  })

  it('no muestra la paginación con una sola página', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')]))

    renderizarTienda()

    await screen.findByRole('heading', { name: 'Arroz' })
    expect(screen.queryByRole('navigation', { name: 'Páginas' })).not.toBeInTheDocument()
  })
})

describe('Catalogo: errores', () => {
  it('muestra el error y reintenta la consulta', async () => {
    vi.mocked(listarCatalogo)
      .mockRejectedValueOnce(new Error('No se pudo conectar con el servidor.'))
      .mockResolvedValueOnce(resultado([producto('p1', 'Arroz')]))
    const { user } = renderizarTienda()

    expect(await screen.findByText('No pudimos cargar el catálogo')).toBeInTheDocument()
    expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Arroz' })).toBeInTheDocument()
    expect(listarCatalogo).toHaveBeenCalledTimes(2)
  })

  it('si fallan las categorías, la tienda sigue mostrando los productos', async () => {
    vi.mocked(listarCategorias).mockRejectedValue(new Error('Sin conexión'))
    vi.mocked(listarCatalogo).mockResolvedValue(resultado([producto('p1', 'Arroz')]))

    renderizarTienda()

    expect(await screen.findByRole('heading', { name: 'Arroz' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Categorías' })).getAllByRole('link')).toHaveLength(1)
  })
})

describe('Catalogo: carrito', () => {
  it('agregar productos actualiza el botón del carrito del encabezado', async () => {
    vi.mocked(listarCatalogo).mockResolvedValue(
      resultado([producto('p1', 'Arroz', { precioUsd: 1.5 }), producto('p2', 'Harina', { precioUsd: 2 })]),
    )
    const { user } = renderizarTienda()
    await screen.findByRole('heading', { name: 'Arroz' })
    expect(screen.getByRole('button', { name: 'Carrito: 0 productos' })).toHaveTextContent('$0.00')

    const [agregarArroz, agregarHarina] = screen.getAllByRole('button', { name: 'Agregar' })
    await user.click(agregarArroz)
    await user.click(agregarHarina)
    await user.click(screen.getByRole('button', { name: 'Agregar una unidad de Arroz' }))

    const carrito = screen.getByRole('button', { name: 'Carrito: 3 productos' })
    expect(carrito).toHaveTextContent('$5.00')
    expect(carrito).toHaveTextContent('3')
  })
})
