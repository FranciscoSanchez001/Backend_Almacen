import { useState } from 'react'
import { useCarrito } from '../context/CarritoContext'
import { formatoBs, formatoUsd } from '../utils/formato'
import Icono from './Icono'

// Tarjeta de un producto del catálogo: imagen, nombre, precio en USD (y Bs debajo)
// y el botón para agregarlo al carrito, que se vuelve un selector de cantidad.
export default function TarjetaProducto({ producto }) {
  const { cantidadDe, cambiarCantidad } = useCarrito()
  const [sinImagen, setSinImagen] = useState(!producto.imagenUrl)
  const cantidad = cantidadDe(producto.id)
  const pocasUnidades = producto.stockDisponible <= 5

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-superficie transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square bg-slate-50">
        {sinImagen ? (
          <div className="grid h-full place-items-center text-slate-300">
            <Icono nombre="bolsa" className="h-16 w-16" grosor={1.4} />
          </div>
        ) : (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            loading="lazy"
            onError={() => setSinImagen(true)}
            className="h-full w-full object-contain p-4 transition group-hover:scale-105"
          />
        )}
        {pocasUnidades && (
          <span className="absolute left-2 top-2 rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
            ¡Quedan {producto.stockDisponible}!
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{producto.categoria}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-10 text-sm font-semibold text-slate-800" title={producto.nombre}>
          {producto.nombre}
        </h3>
        <p className="text-xs text-slate-400">Por {producto.unidadMedida}</p>

        <div className="mt-2">
          <p className="text-lg font-extrabold text-slate-900">{formatoUsd(producto.precioUsd)}</p>
          {producto.precioBs != null && <p className="text-xs text-slate-500">{formatoBs(producto.precioBs)}</p>}
        </div>

        <div className="mt-auto pt-3">
          {cantidad === 0 ? (
            <button
              type="button"
              onClick={() => cambiarCantidad(producto, 1)}
              className="w-full rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Agregar
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-full border-2 border-emerald-600">
              <button
                type="button"
                onClick={() => cambiarCantidad(producto, cantidad - 1)}
                aria-label={`Quitar una unidad de ${producto.nombre}`}
                className="h-9 w-10 rounded-l-full text-lg font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                −
              </button>
              <span className="text-sm font-bold" aria-live="polite">
                {cantidad}
              </span>
              <button
                type="button"
                onClick={() => cambiarCantidad(producto, cantidad + 1)}
                disabled={cantidad >= producto.stockDisponible}
                aria-label={`Agregar una unidad de ${producto.nombre}`}
                className="h-9 w-10 rounded-r-full text-lg font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-30"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
