// Constantes y utilidades compartidas por las pantallas del panel.

export const ESTADOS_PEDIDO = {
  pendiente: { nombre: 'Pendiente', clase: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' },
  asignado: { nombre: 'Asignado', clase: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
  en_camino: { nombre: 'En camino', clase: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' },
  entregado: { nombre: 'Entregado', clase: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
  rechazado: { nombre: 'Rechazado', clase: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' },
  expirado: { nombre: 'Expirado', clase: 'bg-slate-100 text-slate-600' },
}

export const METODOS_PAGO = { transferencia: 'Transferencia', pago_movil: 'Pago móvil', binance: 'Binance' }

// Clases de botones e inputs, para que todo el panel se vea igual.
export const claseBoton = {
  primario:
    'rounded-lg bg-marca-700 dark:bg-marca-600 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800 dark:hover:bg-marca-500 disabled:cursor-not-allowed disabled:opacity-60',
  secundario:
    'rounded-lg border border-slate-300 bg-superficie px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  peligro:
    'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60',
  pequeno:
    'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50',
}

export const claseInput = (error) =>
  `w-full rounded-lg border bg-superficie px-3 py-2 text-sm outline-none focus:ring-2 ${
    error ? 'border-red-400 dark:border-red-700 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900' : 'border-slate-300 focus:border-marca-500 focus:ring-marca-100 dark:focus:ring-marca-700'
  }`

// Convierte los errores de validación de la API ({ errors: { Campo: [...] } }) en { campo: mensaje }.
export function erroresPorCampo(err) {
  const porCampo = {}
  for (const [campo, mensajes] of Object.entries(err.datos?.errors ?? {})) {
    porCampo[campo.charAt(0).toLowerCase() + campo.slice(1)] = mensajes[0]
  }
  return Object.keys(porCampo).length ? porCampo : { general: err.message }
}
