import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarrito } from '../context/CarritoContext'
import { formatoUsd } from '../utils/formato'
import Icono from './Icono'

// Cajón lateral del carrito: cambiar cantidades, quitar productos y pasar al checkout.
// Los precios son los del catálogo cuando se agregaron; el checkout vuelve a cotizar con la API.
export default function CarritoPanel({ abierto, alCerrar }) {
  const { lineas, cambiarCantidad, quitar, totalUnidades, totalUsd } = useCarrito()
  const navegar = useNavigate()

  useEffect(() => {
    if (!abierto) return
    const alTecla = (e) => e.key === 'Escape' && alCerrar()
    document.addEventListener('keydown', alTecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTecla)
      document.body.style.overflow = ''
    }
  }, [abierto, alCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={alCerrar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
        className="relative flex h-full w-full max-w-md flex-col bg-superficie shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Tu carrito {totalUnidades > 0 && <span className="text-sm font-normal text-slate-500">({totalUnidades})</span>}
          </h2>
          <button type="button" onClick={alCerrar} aria-label="Cerrar carrito" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {lineas.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <Icono nombre="canasta" className="mx-auto block h-12 w-12 text-slate-300" grosor={1.4} />
              <p className="mt-3 font-semibold text-slate-800">Tu carrito está vacío</p>
              <p className="text-sm text-slate-500">Agrega productos desde el catálogo.</p>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
              {lineas.map(({ producto, cantidad }) => (
                <li key={producto.id} className="flex gap-3 py-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-slate-50">
                    {producto.imagenUrl ? (
                      <img src={producto.imagenUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Icono nombre="bolsa" className="h-8 w-8 text-slate-300" grosor={1.4} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{producto.nombre}</p>
                    <p className="text-sm">
                      <span className="font-bold text-slate-900">{formatoUsd(producto.precioUsd)}</span>
                      {producto.precioOriginalUsd != null && (
                        <span className="ml-2 text-xs text-slate-400 line-through">{formatoUsd(producto.precioOriginalUsd)}</span>
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-slate-300">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(producto, cantidad - 1)}
                          aria-label={`Quitar una unidad de ${producto.nombre}`}
                          className="h-8 w-8 rounded-l-full font-bold text-emerald-700 hover:bg-slate-100 dark:text-emerald-300"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{cantidad}</span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(producto, cantidad + 1)}
                          disabled={cantidad >= producto.stockDisponible}
                          aria-label={`Agregar una unidad de ${producto.nombre}`}
                          className="h-8 w-8 rounded-r-full font-bold text-emerald-700 hover:bg-slate-100 disabled:opacity-30 dark:text-emerald-300"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitar(producto.id)}
                        className="text-xs font-medium text-red-700 hover:underline dark:text-red-300"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatoUsd(producto.precioUsd * cantidad)}</p>
                </li>
              ))}
            </ul>

            <footer className="space-y-3 border-t border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-xl font-extrabold text-slate-900">{formatoUsd(totalUsd)}</span>
              </div>
              <p className="text-xs text-slate-500">Si tienes un cupón, lo aplicas en el siguiente paso.</p>
              <button
                type="button"
                onClick={() => {
                  alCerrar()
                  navegar('/checkout')
                }}
                className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Ir a pagar
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
