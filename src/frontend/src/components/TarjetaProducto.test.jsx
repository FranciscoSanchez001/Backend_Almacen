import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import TarjetaProducto from './TarjetaProducto'
import { CarritoProvider, useCarrito } from '../context/CarritoContext'

const producto = (extra = {}) => ({
  id: 'p1',
  nombre: 'Harina de maíz',
  categoria: 'Víveres',
  unidadMedida: 'paquete',
  precioUsd: 1.25,
  precioBs: 50,
  stockDisponible: 20,
  imagenUrl: 'https://cdn.pruebas/harina.png',
  ...extra,
})

// Muestra lo que quedó en el carrito, para comprobarlo desde fuera de la tarjeta.
function ResumenCarrito() {
  const { totalUnidades } = useCarrito()
  return <p data-testid="unidades">{totalUnidades}</p>
}

function renderizarTarjeta(datos) {
  const user = userEvent.setup()
  render(
    <CarritoProvider>
      <TarjetaProducto producto={datos} />
      <ResumenCarrito />
    </CarritoProvider>,
  )
  return { user }
}

describe('TarjetaProducto: datos del producto', () => {
  it('muestra nombre, categoría, unidad y precio en USD y Bs', () => {
    renderizarTarjeta(producto())

    expect(screen.getByRole('heading', { name: 'Harina de maíz' })).toBeInTheDocument()
    expect(screen.getByText('Víveres')).toBeInTheDocument()
    expect(screen.getByText('Por paquete')).toBeInTheDocument()
    expect(screen.getByText('$1.25')).toBeInTheDocument()
    expect(screen.getByText('Bs 50,00')).toBeInTheDocument()
  })

  it('sin precio en Bs muestra solo el precio en USD', () => {
    renderizarTarjeta(producto({ precioBs: null }))

    expect(screen.getByText('$1.25')).toBeInTheDocument()
    expect(screen.queryByText(/^Bs /)).not.toBeInTheDocument()
  })

  it('muestra la imagen del producto con su nombre como texto alternativo', () => {
    renderizarTarjeta(producto())

    expect(screen.getByRole('img', { name: 'Harina de maíz' })).toHaveAttribute('src', 'https://cdn.pruebas/harina.png')
  })

  it('sin imagen, o si la imagen falla, no muestra una imagen rota', () => {
    renderizarTarjeta(producto())

    fireEvent.error(screen.getByRole('img', { name: 'Harina de maíz' }))

    expect(screen.queryByRole('img', { name: 'Harina de maíz' })).not.toBeInTheDocument()
  })

  it('avisa cuando quedan 5 unidades o menos', () => {
    renderizarTarjeta(producto({ stockDisponible: 3 }))

    expect(screen.getByText('¡Quedan 3!')).toBeInTheDocument()
  })

  it('no avisa con stock suficiente', () => {
    renderizarTarjeta(producto({ stockDisponible: 6 }))

    expect(screen.queryByText(/Quedan/)).not.toBeInTheDocument()
  })
})

describe('TarjetaProducto: carrito', () => {
  it('Agregar pone una unidad y cambia a un selector de cantidad', async () => {
    const { user } = renderizarTarjeta(producto())

    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(screen.getByTestId('unidades')).toHaveTextContent('1')
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar una unidad de Harina de maíz' })).toBeInTheDocument()
  })

  it('suma y resta unidades; al llegar a cero vuelve el botón Agregar', async () => {
    const { user } = renderizarTarjeta(producto())
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    await user.click(screen.getByRole('button', { name: 'Agregar una unidad de Harina de maíz' }))
    expect(screen.getByTestId('unidades')).toHaveTextContent('2')

    await user.click(screen.getByRole('button', { name: 'Quitar una unidad de Harina de maíz' }))
    await user.click(screen.getByRole('button', { name: 'Quitar una unidad de Harina de maíz' }))

    expect(screen.getByTestId('unidades')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('no deja superar el stock disponible', async () => {
    const { user } = renderizarTarjeta(producto({ stockDisponible: 2 }))
    await user.click(screen.getByRole('button', { name: 'Agregar' }))
    const mas = screen.getByRole('button', { name: 'Agregar una unidad de Harina de maíz' })

    await user.click(mas)

    expect(screen.getByTestId('unidades')).toHaveTextContent('2')
    expect(mas).toBeDisabled()
  })
})
