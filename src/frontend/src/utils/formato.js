// Formatos de la app: dinero (USD principal, Bs debajo), fechas y duraciones.
// La API manda las fechas en UTC; se muestran en la hora local del navegador.
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const bs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 });
const fechaHora = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
const fechaCorta = new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short' });

export const formatoUsd = (valor) => usd.format(valor);
export const formatoBs = (valor) => `Bs ${bs.format(valor)}`;
export const formatoNumero = (valor) => numero.format(valor);
export const formatoPct = (valor) => `${numero.format(valor)} %`;
export const formatoFechaHora = (iso) => fechaHora.format(new Date(iso));

// "2026-10-05" (fecha sin hora de la API) → "05 oct". Se arma en hora local para no correr el día.
export function formatoDia(yyyyMmDd) {
  const [a, m, d] = yyyyMmDd.split('-').map(Number);
  return fechaCorta.format(new Date(a, m - 1, d));
}

// Minutos → "1 h 26 min".
export function formatoMinutos(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

// Fecha local de hoy en yyyy-MM-dd (lo que esperan los filtros de la API).
export function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
