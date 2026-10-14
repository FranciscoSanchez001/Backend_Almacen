// Semáforo de ocupación del almacén. El nivel lo calcula la API (OcupacionAlmacen):
// < 20 % baja, 20–85 % óptima, 85–100 % alta y > 100 % saturada.
// Lleva ícono + texto para que el nivel nunca dependa solo del color.
const NIVELES = {
  baja: { texto: 'Baja', icono: 'caja', clase: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300', barra: 'bg-sky-500' },
  optima: { texto: 'Óptima', icono: 'check', clase: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', barra: 'bg-emerald-500' },
  alta: { texto: 'Alta', icono: 'alerta', clase: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', barra: 'bg-amber-500' },
  saturada: { texto: 'Saturada', icono: 'agotado', clase: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300', barra: 'bg-red-500' },
}

const SIN_DATOS = { texto: 'Sin capacidad', icono: 'caja', clase: 'bg-slate-100 text-slate-600', barra: 'bg-slate-400' }

export const nivelOcupacion = (nivel) => NIVELES[nivel] ?? SIN_DATOS

// Ancho de la barra: la ocupación puede pasar de 100 %, pero la barra se llena como máximo.
export const anchoBarra = (porcentaje) => `${Math.min(Math.max(porcentaje ?? 0, 0), 100)}%`
