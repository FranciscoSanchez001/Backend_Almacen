import { useEffect, useId } from 'react'

// Ventana modal reutilizable. En móvil sale desde abajo y ocupa todo el ancho;
// en pantallas grandes queda centrada. Se cierra con Escape o tocando el fondo.
export default function Modal({ abierto, titulo, alCerrar, children, ancho = 'sm:max-w-lg' }) {
  const idTitulo = useId()

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={alCerrar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-superficie shadow-xl sm:rounded-2xl ${ancho}`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-superficie px-5 py-4">
          <h2 id={idTitulo} className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
