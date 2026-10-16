import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../api/notificaciones'
import { EVENTO_AVISOS, avisarCambioAvisos, tipoAviso } from '../utils/avisos'
import { formatoFechaHora } from '../utils/formato'
import { claseBoton } from '../utils/panel'
import Icono from './Icono'

// Campana del encabezado del panel: muestra cuántos avisos hay sin leer y, al pulsarla,
// despliega la lista en la página en la que se esté, para leerlos sin salir de ella.
// Se actualiza cada minuto, al cambiar de página y cuando otra parte de la pantalla los marca.
export default function CampanaAvisos() {
  const [avisos, setAvisos] = useState({ items: [], total: 0 })
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const { pathname } = useLocation()

  const cargar = useCallback(
    () =>
      listarNotificaciones()
        .then((r) => {
          setAvisos(r)
          setError(false)
        })
        .catch(() => setError(true)), // La campana no debe romper la pantalla.
    [],
  )

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    window.addEventListener(EVENTO_AVISOS, cargar)
    return () => {
      clearInterval(t)
      window.removeEventListener(EVENTO_AVISOS, cargar)
    }
  }, [cargar, pathname])

  // Al cambiar de página se cierra la lista.
  useEffect(() => setAbierto(false), [pathname])

  // Cerrar al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!abierto) return
    const alClic = (e) => !contenedor.current?.contains(e.target) && setAbierto(false)
    const alTecla = (e) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  function alternar() {
    if (!abierto) cargar()
    setAbierto((v) => !v)
  }

  async function leer(id) {
    setAvisos((a) => ({ items: a.items.filter((n) => n.id !== id), total: Math.max(0, a.total - 1) }))
    await marcarLeida(id).catch(() => {})
    avisarCambioAvisos()
  }

  async function leerTodas() {
    setAvisos({ items: [], total: 0 })
    await marcarTodasLeidas().catch(() => {})
    avisarCambioAvisos()
  }

  const { total, items } = avisos

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={`Avisos sin leer: ${total}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
        </svg>
        {total > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-superficie shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Avisos</p>
            {total > 0 && (
              <button type="button" onClick={leerTodas} className="text-xs font-medium text-marca-700 dark:text-marca-200 hover:underline">
                Marcar todos como leídos
              </button>
            )}
          </div>

          {error && items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No se pudieron cargar los avisos.</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No hay avisos sin leer.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const tipo = tipoAviso(n)
                return (
                  <li key={n.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Icono nombre={tipo.icono} className="mr-0.5 h-4 w-4 align-[-3px]" tono /> {tipo.texto(n)}
                      <span className="block text-xs text-slate-500">{formatoFechaHora(n.creadoEn)}</span>
                    </span>
                    <button type="button" onClick={() => leer(n.id)} className={claseBoton.pequeno}>
                      Leído
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-slate-100 px-4 py-2.5 text-right">
            <Link to="/panel" className="text-xs font-medium text-marca-700 dark:text-marca-200 hover:underline">
              Ir al resumen del día →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
