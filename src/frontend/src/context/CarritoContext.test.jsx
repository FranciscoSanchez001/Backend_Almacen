import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CarritoProvider, useCarrito } from './CarritoContext'

const arroz = { id: 'p1', nombre: 'Arroz', precioUsd: 1.5, stockDisponible: 10 }
const leche = { id: 'p2', nombre: 'Leche', precioUsd: 2.25, stockDisponible: 3 }

const usarCarrito = () => renderHook(() => useCarrito(), { wrapper: CarritoProvider }).result

describe('CarritoContext', () => {
  it('arranca vacío', () => {
    const carrito = usarCarrito()

    expect(carrito.current.lineas).toEqual([])
    expect(carrito.current.totalUnidades).toBe(0)
    expect(carrito.current.totalUsd).toBe(0)
  })

  it('agrega productos y calcula unidades y total en USD', () => {
    const carrito = usarCarrito()

    act(() => carrito.current.cambiarCantidad(arroz, 2))
    act(() => carrito.current.cambiarCantidad(leche, 1))

    expect(carrito.current.lineas).toHaveLength(2)
    expect(carrito.current.cantidadDe('p1')).toBe(2)
    expect(carrito.current.totalUnidades).toBe(3)
    expect(carrito.current.totalUsd).toBeCloseTo(5.25)
  })

  it('cambiar la cantidad reemplaza la anterior', () => {
    const carrito = usarCarrito()

    act(() => carrito.current.cambiarCantidad(arroz, 2))
    act(() => carrito.current.cambiarCantidad(arroz, 5))

    expect(carrito.current.cantidadDe('p1')).toBe(5)
    expect(carrito.current.lineas).toHaveLength(1)
  })

  it('no permite superar el stock disponible', () => {
    const carrito = usarCarrito()

    act(() => carrito.current.cambiarCantidad(leche, 8))

    expect(carrito.current.cantidadDe('p2')).toBe(3)
  })

  it('con cantidad 0 o negativa quita el producto', () => {
    const carrito = usarCarrito()
    act(() => carrito.current.cambiarCantidad(arroz, 2))

    act(() => carrito.current.cambiarCantidad(arroz, 0))

    expect(carrito.current.cantidadDe('p1')).toBe(0)
    expect(carrito.current.lineas).toEqual([])
  })

  it('un producto sin stock no se agrega', () => {
    const carrito = usarCarrito()

    act(() => carrito.current.cambiarCantidad({ ...arroz, stockDisponible: 0 }, 1))

    expect(carrito.current.lineas).toEqual([])
  })

  it('se guarda en el navegador y se recupera al recargar', () => {
    const primero = usarCarrito()
    act(() => primero.current.cambiarCantidad(arroz, 4))

    const recargado = usarCarrito()

    expect(recargado.current.cantidadDe('p1')).toBe(4)
    expect(JSON.parse(localStorage.getItem('almacen.carrito')).p1.cantidad).toBe(4)
  })

  it('si lo guardado está corrupto, arranca vacío', () => {
    localStorage.setItem('almacen.carrito', '{no es json')

    const carrito = usarCarrito()

    expect(carrito.current.lineas).toEqual([])
  })
})
