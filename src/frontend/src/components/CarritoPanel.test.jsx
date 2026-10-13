import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CarritoPanel from './CarritoPanel'
import { renderizar } from '../test/renderizar'

const arroz = { id: 'p1', nombre: 'Arroz', precioUsd: 1.5, precioOriginalUsd: 2, stockDisponible: 3, imagenUrl: null }
const cafe = { id: 'p2', nombre: 'Café', precioUsd: 5, stockDisponible: 10, imagenUrl: null }

function guardarCarrito() {
  localStorage.setItem(
    'almacen.carrito',
    JSON.stringify({ p1: { producto: arroz, cantidad: 2 }, p2: { producto: cafe, cantidad: 1 } }),
  )
}

const abrir = (alCerrar = vi.fn()) => ({ alCerrar, ...renderizar(<CarritoPanel abierto alCerrar={alCerrar} />) })

describe('CarritoPanel', () => {
  it('cerrado no muestra nada', () => {
    renderizar(<CarritoPanel abierto={false} alCerrar={() => {}} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('vacío invita a agregar productos', () => {
    abrir()

    expect(screen.getByText('Tu carrito está vacío')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ir a pagar' })).not.toBeInTheDocument()
  })

  it('lista los productos con su precio, el de oferta tachado y el subtotal', () => {
    guardarCarrito()
    abrir()

    const panel = screen.getByRole('dialog', { name: 'Tu carrito' })
    expect(within(panel).getByText('Arroz')).toBeInTheDocument()
    expect(within(panel).getByText('$2.00')).toHaveClass('line-through')
    expect(within(panel).getByText('$8.00')).toBeInTheDocument()
  })

  it('cambia cantidades sin pasar del stock y quita productos', async () => {
    guardarCarrito()
    const { user } = abrir()

    await user.click(screen.getByRole('button', { name: 'Agregar una unidad de Arroz' }))
    expect(screen.getByRole('button', { name: 'Agregar una unidad de Arroz' })).toBeDisabled() // 3 de 3

    const filaCafe = screen.getByText('Café').closest('li')
    await user.click(within(filaCafe).getByRole('button', { name: 'Quitar' }))

    expect(screen.queryByText('Café')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('almacen.carrito'))).toEqual({ p1: { producto: arroz, cantidad: 3 } })
  })

  it('"Ir a pagar" cierra el panel y abre el checkout', async () => {
    guardarCarrito()
    const { user, alCerrar } = abrir()

    await user.click(screen.getByRole('button', { name: 'Ir a pagar' }))

    expect(alCerrar).toHaveBeenCalled()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/checkout')
  })

  it('se cierra con Escape', async () => {
    const { user, alCerrar } = abrir()

    await user.keyboard('{Escape}')

    expect(alCerrar).toHaveBeenCalled()
  })
})
