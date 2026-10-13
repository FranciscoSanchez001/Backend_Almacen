import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarritoProvider, useCarrito } from './CarritoContext'
import { registrarEvento } from '../utils/analitica'

vi.mock('../utils/analitica', () => ({ registrarEvento: vi.fn() }))

const arroz = { id: 'p1', nombre: 'Arroz', precioUsd: 1.5, stockDisponible: 5 }

beforeEach(() => vi.clearAllMocks())

describe('CarritoContext: analítica', () => {
  it('registra las unidades agregadas y quitadas, sin pasar del stock', () => {
    const carrito = renderHook(() => useCarrito(), { wrapper: CarritoProvider }).result

    act(() => carrito.current.cambiarCantidad(arroz, 2))
    act(() => carrito.current.cambiarCantidad(arroz, 9)) // tope: 5
    act(() => carrito.current.cambiarCantidad(arroz, 4))
    act(() => carrito.current.quitar('p1'))

    expect(vi.mocked(registrarEvento).mock.calls).toEqual([
      ['agregar_carrito', { productoId: 'p1', cantidad: 2 }],
      ['agregar_carrito', { productoId: 'p1', cantidad: 3 }],
      ['quitar_carrito', { productoId: 'p1', cantidad: 1 }],
      ['quitar_carrito', { productoId: 'p1', cantidad: 4 }],
    ])
  })

  it('sin cambio real de cantidad no registra nada; vaciar tras la compra tampoco', () => {
    const carrito = renderHook(() => useCarrito(), { wrapper: CarritoProvider }).result
    act(() => carrito.current.cambiarCantidad(arroz, 5))
    vi.mocked(registrarEvento).mockClear()

    act(() => carrito.current.cambiarCantidad(arroz, 6)) // ya está en el tope
    act(() => carrito.current.vaciar())

    expect(registrarEvento).not.toHaveBeenCalled()
  })
})
