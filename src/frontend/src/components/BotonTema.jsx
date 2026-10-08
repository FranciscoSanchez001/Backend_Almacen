import { useTema } from '../context/ThemeContext'

// Selector de tema: alterna entre el tema institucional claro (Azul UNET) y el oscuro.
export default function BotonTema({ className = '' }) {
  const { oscuro, alternar } = useTema()
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oscuro}
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Tema claro' : 'Modo oscuro'}
      className={`rounded-lg p-2 text-slate-600 hover:bg-slate-100 ${className}`}
    >
      {oscuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path strokeLinecap="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  )
}
