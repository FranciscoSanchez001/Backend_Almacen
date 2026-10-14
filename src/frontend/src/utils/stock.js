// Estado de un producto según sus umbrales de seguridad (stock mínimo y máximo).
// Lleva ícono + texto para que la alerta nunca dependa solo del color.
export function alertaStock(p) {
  if (p.stockDisponible === 0) return { texto: 'Agotado', icono: 'agotado', clase: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' };
  if (p.stockDisponible < p.stockMinimo) return { texto: 'Bajo mínimo', icono: 'alerta', clase: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' };
  if (p.stockDisponible > p.stockMaximo) return { texto: 'Sobre máximo', icono: 'caja', clase: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' };
  return { texto: 'Normal', icono: 'check', clase: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' };
}
