import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { registrarEvento } from '../utils/analitica'

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
    // Analítica: cuántas unidades se agregaron o se quitaron.
    function registrarCambio(productoId, antes, despues) {
      if (despues > antes) registrarEvento('agregar_carrito', { productoId, cantidad: despues - antes })
      else if (despues < antes) registrarEvento('quitar_carrito', { productoId, cantidad: antes - despues })
    }

    // Cambia la cantidad de un producto; con 0 o menos lo quita. No pasa del stock disponible.
    function cambiarCantidad(producto, cantidad) {
      registrarCambio(producto.id, lineas[producto.id]?.cantidad ?? 0, Math.max(0, Math.min(cantidad, producto.stockDisponible)))
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
      quitar: (id) => {
        registrarCambio(id, lineas[id]?.cantidad ?? 0, 0)
        setLineas((actual) => {
          const siguiente = { ...actual }
          delete siguiente[id]
          return siguiente
        })
      },
      // Después de confirmar el pedido.
      vaciar: () => setLineas({}),
      // Retira solo las unidades enviadas; conserva lo añadido durante la petición.
      retirarComprados: (comprados) => setLineas(actual => {
        const siguiente = { ...actual }
        for (const { productoId, cantidad } of comprados) {
          const linea = siguiente[productoId]
          if (!linea) continue
          if (linea.cantidad <= cantidad) delete siguiente[productoId]
          else siguiente[productoId] = { ...linea, cantidad: linea.cantidad - cantidad }
        }
        return siguiente
      }),
      // Lo que espera la API: [{ productoId, cantidad }].
      items: lista.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
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
