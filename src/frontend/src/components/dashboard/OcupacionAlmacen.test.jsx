import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OcupacionAlmacen from './OcupacionAlmacen'

const producto = (id, nombre, disponible, reservado, maximo, ocupacion, nivel) => ({
  productoId: id,
  producto: nombre,
  categoria: 'Víveres',
  stockDisponible: disponible,
  stockReservado: reservado,
  stockMaximo: maximo,
  ocupacion,
  nivelOcupacion: nivel,
})

const inventario = (extra = {}) => ({
  ocupacionGlobal: 87.5,
  nivelOcupacionGlobal: 'alta',
  productosSaturados: 1,
  ocupacionPorCategoria: [
    { categoria: 'Bebidas', productos: 1, unidades: 150, capacidad: 150, ocupacion: 100, nivelOcupacion: 'alta' },
    { categoria: 'Víveres', productos: 2, unidades: 30, capacidad: 150, ocupacion: 20, nivelOcupacion: 'optima' },
  ],
  productos: [
    producto('p1', 'Arroz', 20, 5, 50, 50, 'optima'),
    producto('p2', 'Cloro', 120, 5, 100, 125, 'saturada'),
    producto('p3', 'Harina', 5, 0, 100, 5, 'baja'),
  ],
  ...extra,
})

describe('OcupacionAlmacen', () => {
  it('muestra la ocupación global con su nivel y los productos saturados', () => {
    render(<OcupacionAlmacen inventario={inventario()} />)

    expect(screen.getByTestId('ocupacion-global')).toHaveTextContent('87,5 %')
    expect(screen.getByText('1 producto sobre su capacidad')).toBeInTheDocument()
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0)
  })

  it('dibuja una barra por categoría con unidades y capacidad', () => {
    render(<OcupacionAlmacen inventario={inventario()} />)

    const bebidas = screen.getByRole('progressbar', { name: 'Ocupación de Bebidas' })
    expect(bebidas).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('150 de 150 u.')).toBeInTheDocument()
    expect(screen.getByText('30 de 150 u.')).toBeInTheDocument()
  })

  it('ordena los productos de mayor a menor ocupación y limita la barra al 100 %', () => {
    render(<OcupacionAlmacen inventario={inventario()} />)

    const lista = screen.getByRole('heading', { name: 'Productos más ocupados' }).nextElementSibling
    const barras = within(lista).getAllByRole('progressbar')
    expect(barras.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ocupación de Cloro',
      'Ocupación de Arroz',
      'Ocupación de Harina',
    ])
    // 125 % de ocupación: el texto lo muestra, pero la barra se llena solo hasta el 100 %.
    expect(within(lista).getByText('125 %')).toBeInTheDocument()
    expect(barras[0].firstChild).toHaveStyle({ width: '100%' })
    expect(within(lista).getByText('Saturada')).toBeInTheDocument()
  })

  it('sin productos activos muestra un guion y avisos vacíos', () => {
    render(
      <OcupacionAlmacen
        inventario={inventario({ ocupacionGlobal: null, nivelOcupacionGlobal: null, productosSaturados: 0, ocupacionPorCategoria: [], productos: [] })}
      />,
    )

    expect(screen.getByTestId('ocupacion-global')).toHaveTextContent('—')
    expect(screen.getByText('Ningún producto sobre su capacidad')).toBeInTheDocument()
    expect(screen.getAllByText('Sin productos activos.')).toHaveLength(2)
  })
})
