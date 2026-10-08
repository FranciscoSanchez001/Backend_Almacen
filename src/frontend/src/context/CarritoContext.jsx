import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Carrito de la tienda. Se guarda en el navegador para no perderlo al recargar.
// Cada línea: { producto, cantidad }, indexada por el id del producto.
const CLAVE = 'almacen.carrito'
const CarritoContext = createContext(null)

function leerGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? {}
  } catch {
    return {}
  }
}

export function CarritoProvider({ children }) {
  const [lineas, setLineas] = useState(leerGuardado)

  useEffect(() => {
    localStorage.setItem(CLAVE, JSON.stringify(lineas))
  }, [lineas])

  const valor = useMemo(() => {
    // Cambia la cantidad de un producto; con 0 o menos lo quita. No pasa del stock disponible.
    function cambiarCantidad(producto, cantidad) {
      setLineas((actual) => {
        const siguiente = { ...actual }
        const tope = Math.min(cantidad, producto.stockDisponible)
        if (tope <= 0) delete siguiente[producto.id]
        else siguiente[producto.id] = { producto, cantidad: tope }
        return siguiente
      })
    }

    const lista = Object.values(lineas)
    return {
      lineas: lista,
      cantidadDe: (id) => lineas[id]?.cantidad ?? 0,
      cambiarCantidad,
      totalUnidades: lista.reduce((suma, l) => suma + l.cantidad, 0),
      totalUsd: lista.reduce((suma, l) => suma + l.cantidad * l.producto.precioUsd, 0),
    }
  }, [lineas])

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCarrito() {
  return useContext(CarritoContext)
}
