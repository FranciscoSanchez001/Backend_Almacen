// Piezas pequeñas que repiten todas las pantallas del panel.
import { ESTADOS_PEDIDO, claseBoton } from '../utils/panel'

// Encabezado de una página: título, descripción y acciones a la derecha.
export function EncabezadoPagina({ titulo, detalle, children }) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold">{titulo}</h2>
        {detalle && <p className="mt-1 text-slate-600">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </section>
  )
}

// Cargando / error con reintento / vacío. Si no aplica ninguno, muestra el contenido.
export function EstadoCarga({ cargando, error, vacio, textoVacio = 'No hay nada que mostrar.', alReintentar, children }) {
  if (cargando) {
    return <div className="rounded-2xl border border-slate-200 bg-superficie p-10 text-center text-sm text-slate-500">Cargando…</div>
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-superficie p-10 text-center">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        {alReintentar && (
          <button type="button" onClick={alReintentar} className={`mt-3 ${claseBoton.secundario}`}>
            Reintentar
          </button>
        )}
      </div>
    )
  }
  if (vacio) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-superficie p-10 text-center text-sm text-slate-600">
        {textoVacio}
      </div>
    )
  }
  return children
}

// Aviso que se muestra arriba tras una acción ({ tipo: 'ok' | 'error', texto }).
export function Aviso({ aviso }) {
  if (!aviso) return null
  return (
    <p
      role="status"
      className={`rounded-lg px-4 py-2 text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}
    >
      {aviso.texto}
    </p>
  )
}

// Grupo de botones donde se elige una opción (filtros).
export function Selector({ etiqueta, opciones, valor, alCambiar }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-superficie p-0.5">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          onClick={() => alCambiar(v)}
          aria-pressed={valor === v}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            valor === v ? 'bg-marca-700 dark:bg-marca-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

export function Paginacion({ pagina, total, tamano, alCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  if (paginas <= 1) return null
  return (
    <nav aria-label="Páginas" className="flex items-center justify-center gap-3 pt-2">
      <button type="button" onClick={() => alCambiar(pagina - 1)} disabled={pagina <= 1} className={claseBoton.secundario}>
        ← Anterior
      </button>
      <span className="text-sm text-slate-600">
        Página {pagina} de {paginas}
      </span>
      <button type="button" onClick={() => alCambiar(pagina + 1)} disabled={pagina >= paginas} className={claseBoton.secundario}>
        Siguiente →
      </button>
    </nav>
  )
}

export function EtiquetaEstado({ estado }) {
  const e = ESTADOS_PEDIDO[estado] ?? { nombre: estado, clase: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${e.clase}`}>{e.nombre}</span>
}

export function Campo({ id, etiqueta, ayuda, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p> : ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  )
}
