// Íconos SVG de la interfaz (reemplazan a los emojis). Trazo con currentColor:
// toman el color del texto y se ven igual en todos los sistemas y en modo oscuro.
const TRAZOS = {
  agotado: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  alerta: <path d="M12 9v4m0 4h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  bolsa: <path d="M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 7Zm3 0V6a3 3 0 0 1 6 0v1" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  caja: <path d="M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  camion: (
    <>
      <path d="M3 6h11v10H3zm11 4h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  campana: <path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-8 4a2 2 0 0 0 4 0" />,
  canasta: <path d="M3 10h18l-2 10H5L3 10Zm4 0 4-6m6 6-4-6M9 14v3m6-3v3" />,
  carrito: (
    <>
      <path d="M3 4h2l2.4 11h10.2L20 8H6.2" />
      <circle cx="9" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  descargar: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />,
  externo: <path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  // Moto de reparto: la caja va siempre en ámbar; el resto toma el color del texto.
  moto: (
    <>
      <g className="text-amber-500">
        <rect x="2.5" y="4" width="6" height="5.5" rx="1" fill="currentColor" fillOpacity=".25" />
        <path d="M2.5 6h6M5.5 4v2M5.5 9.5V12" />
      </g>
      <path d="M3.5 15.5C3.5 13.6 5 12 7 12h4.5l1.5 3.5Z" fill="currentColor" fillOpacity=".15" />
      <path d="M8 12v-.8A1.2 1.2 0 0 1 9.2 10h1.6a1.2 1.2 0 0 1 1.2 1.2v.8" />
      <path d="M13 15.5h4.8M15 5.5 18.5 18M13.5 5.5h3l1-1.5M15.8 16.4a3.3 3.3 0 0 1 5.4 0M1 14.5h1.2M.8 17.5h1.5" />
      <circle cx="17.3" cy="8.6" r=".7" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <circle cx="7" cy="18" r=".4" fill="currentColor" />
      <circle cx="18.5" cy="18" r=".4" fill="currentColor" />
    </>
  ),
  recibo: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3" />,
  reloj: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M10 2h4" />
    </>
  ),
  saludo: (
    <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2m0 4.5V6a2 2 0 0 0-4 0v8m12-6a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
  ),
}

// Color según lo que significa el ícono. Se aplica con la prop `tono` cuando el ícono
// va sobre un fondo neutro; dentro de una etiqueta ya coloreada hereda su color.
const TONOS = {
  agotado: 'text-red-600 dark:text-red-400',
  alerta: 'text-amber-500 dark:text-amber-400',
  caja: 'text-sky-600 dark:text-sky-400',
  campana: 'text-violet-500 dark:text-violet-400',
  carrito: 'text-emerald-600 dark:text-emerald-400',
  check: 'text-emerald-600 dark:text-emerald-400',
  moto: 'text-marca-600 dark:text-marca-200',
  recibo: 'text-marca-600 dark:text-marca-200',
  reloj: 'text-amber-500 dark:text-amber-400',
}

export default function Icono({ nombre, className = 'h-4 w-4', grosor = 1.8, tono = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className} ${tono ? (TONOS[nombre] ?? '') : ''}`}
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
