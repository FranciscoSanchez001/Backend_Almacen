import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarrito } from '../context/CarritoContext'
import { formatoUsd } from '../utils/formato'
import Icono from './Icono'

export default function Carrito({ alCerrar }) {
  const dialogo = useRef(null)
  const navegar = useNavigate()
  const { lineas, cambiarCantidad, totalUnidades, totalUsd } = useCarrito()

  useEffect(() => {
    const elemento = dialogo.current
    const focoPrevio = document.activeElement
    const overflowPrevio = document.body.style.overflow
    elemento.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      elemento.close()
      document.body.style.overflow = overflowPrevio
      focoPrevio?.focus()
    }
  }, [])

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-carrito"
      onCancel={(evento) => { evento.preventDefault(); alCerrar() }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-superficie p-0 text-slate-900 shadow-xl backdrop:bg-black/50">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-superficie px-5 py-4">
        <h2 id="titulo-carrito" className="flex items-center gap-2 text-lg font-bold"><Icono nombre="cesta" /> Tu carrito</h2>
        <button type="button" onClick={alCerrar} aria-label="Cerrar carrito"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icono nombre="cerrar" className="h-5 w-5" /></button>
      </div>
      {lineas.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Icono nombre="cesta" className="h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold">Tu carrito está vacío</p>
          <p className="mt-1 text-sm text-slate-500">Agrega productos del catálogo para verlos aquí.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 px-5">
          {lineas.map(({ producto, cantidad }) => (
            <li key={producto.id} className="flex gap-3 py-5">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400">
                <Icono nombre="bolsa" className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{producto.nombre}</h3>
                <p className="mt-1 text-xs text-slate-500">{formatoUsd(producto.precioUsd)} por {producto.unidadMedida ?? 'unidad'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div role="group" aria-label={`Cantidad de ${producto.nombre}`} className="inline-flex items-center rounded-full border border-slate-300">
                    <button type="button" aria-label={`Quitar una unidad de ${producto.nombre}`}
                      onClick={() => cambiarCantidad(producto, cantidad - 1)}
                      className="h-9 w-9 rounded-l-full text-lg font-semibold hover:bg-slate-100">−</button>
                    <span aria-live="polite" className="min-w-8 text-center text-sm font-semibold">{cantidad}</span>
                    <button type="button" aria-label={`Agregar una unidad de ${producto.nombre}`} disabled={cantidad >= producto.stockDisponible}
                      onClick={() => cambiarCantidad(producto, cantidad + 1)}
                      className="h-9 w-9 rounded-r-full text-lg font-semibold hover:bg-slate-100 disabled:opacity-30">+</button>
                  </div>
                  <button type="button" aria-label={`Eliminar ${producto.nombre} del carrito`}
                    onClick={() => cambiarCantidad(producto, 0)}
                    className="text-xs font-medium text-red-700 hover:underline dark:text-red-300">Eliminar</button>
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold" aria-label={`Subtotal de ${producto.nombre}`} aria-live="polite">{formatoUsd(cantidad * producto.precioUsd)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="sticky bottom-0 border-t border-slate-200 bg-superficie px-5 py-4">
        {lineas.length > 0 && <div className="mb-4 flex items-center justify-between gap-3" aria-live="polite">
          <p className="text-sm text-slate-500">Subtotal · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}</p>
          <p className="text-xl font-bold" aria-label="Subtotal del carrito">{formatoUsd(totalUsd)}</p>
        </div>}
        {lineas.length > 0 && <button type="button" onClick={() => { alCerrar(); navegar('/checkout') }}
          className="mb-2 w-full rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Finalizar compra</button>}
        <button type="button" onClick={alCerrar} className="w-full rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100">Seguir comprando</button>
      </div>
    </dialog>
  )
}
