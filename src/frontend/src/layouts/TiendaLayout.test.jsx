import { screen, within } from '@testing-library/react'
import { Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TiendaLayout from './TiendaLayout'
import { listarCategorias } from '../api/catalogo'
import { renderizar } from '../test/renderizar'

vi.mock('../api/catalogo', () => ({ listarCatalogo: vi.fn(), listarCategorias: vi.fn() }))

const CATEGORIAS = [
  { id: 'c1', nombre: 'Víveres' },
  { id: 'c2', nombre: 'Bebidas' },
]

// Página hija: muestra la búsqueda actual y las categorías que recibe del layout.
function PaginaHija() {
  const { search } = useLocation()
  const { categorias } = useOutletContext()
  return (
    <>
      <p data-testid="busqueda">{search}</p>
      <p data-testid="categorias-recibidas">{categorias.map((c) => c.nombre).join(',')}</p>
    </>
  )
}

function Tienda() {
  return (
    <Routes>
      <Route element={<TiendaLayout />}>
        <Route index element={<PaginaHija />} />
      </Route>
    </Routes>
  )
}

const renderizarTienda = (ruta = '/') => renderizar(<Tienda />, { ruta, patron: '*' })

const barraCategorias = () => screen.getByRole('navigation', { name: 'Categorías' })

beforeEach(() => {
  vi.mocked(listarCategorias).mockReset().mockResolvedValue(CATEGORIAS)
})

describe('TiendaLayout: categorías', () => {
  it('muestra la barra de categorías y se las pasa a la página', async () => {
    renderizarTienda()

    const barra = barraCategorias()
    expect(await within(barra).findByRole('link', { name: 'Víveres' })).toHaveAttribute('href', '/?categoria=c1')
    expect(within(barra).getByRole('link', { name: 'Bebidas' })).toHaveAttribute('href', '/?categoria=c2')
    expect(within(barra).getByRole('link', { name: 'Todo' })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('categorias-recibidas')).toHaveTextContent('Víveres,Bebidas')
  })

  it('elegir una categoría la pone en la URL', async () => {
    const { user } = renderizarTienda()

    await user.click(await within(barraCategorias()).findByRole('link', { name: 'Bebidas' }))

    expect(screen.getByTestId('busqueda')).toHaveTextContent('?categoria=c2')
  })

  it('sin categorías (error de la API) muestra solo "Todo"', async () => {
    vi.mocked(listarCategorias).mockRejectedValue(new Error('Sin conexión'))

    renderizarTienda()

    await vi.waitFor(() => expect(listarCategorias).toHaveBeenCalled())
    expect(within(barraCategorias()).getAllByRole('link')).toHaveLength(1)
  })
})

describe('TiendaLayout: buscador', () => {
  it('buscar pone el texto, sin espacios, en ?q', async () => {
    const { user } = renderizarTienda()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), '  harina pan ')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(screen.getByTestId('busqueda')).toHaveTextContent('?q=harina%20pan')
  })

  it('buscar sin texto quita la búsqueda', async () => {
    const { user } = renderizarTienda('/?q=arroz')
    const buscador = screen.getByRole('searchbox', { name: 'Buscar productos' })
    expect(buscador).toHaveValue('arroz')

    await user.clear(buscador)
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(screen.getByTestId('busqueda')).toBeEmptyDOMElement()
  })

  it('se puede buscar con la tecla Enter', async () => {
    const { user } = renderizarTienda()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'café{Enter}')

    expect(screen.getByTestId('busqueda')).toHaveTextContent('?q=caf%C3%A9')
  })
})

describe('TiendaLayout: carrito', () => {
  it('con el carrito vacío muestra cero productos y $0.00', () => {
    renderizarTienda()

    const carrito = screen.getByRole('button', { name: 'Carrito: 0 productos' })
    expect(carrito).toHaveTextContent('$0.00')
  })

  it('muestra las unidades y el total del carrito guardado', () => {
    localStorage.setItem(
      'almacen.carrito',
      JSON.stringify({
        p1: { producto: { id: 'p1', precioUsd: 1.5, stockDisponible: 10 }, cantidad: 2 },
        p2: { producto: { id: 'p2', precioUsd: 4, stockDisponible: 10 }, cantidad: 1 },
      }),
    )

    renderizarTienda()

    const carrito = screen.getByRole('button', { name: 'Carrito: 3 productos' })
    expect(carrito).toHaveTextContent('$7.00')
    expect(carrito).toHaveTextContent('3')
  })
})
