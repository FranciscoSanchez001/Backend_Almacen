import iconos from '../assets/iconos.json'

// Los iconos acompañan textos o controles con nombre accesible; no se anuncian dos veces.
export default function Icono({ nombre, className = 'h-[1em] w-[1em]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}>
      <path d={iconos[nombre]} />
    </svg>
  )
}
