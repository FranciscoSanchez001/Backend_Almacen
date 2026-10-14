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

// Vigencias por día (ofertas y cupones). En pantalla se elige "desde" y "hasta" inclusive, en
// hora local; la API guarda [desde, hasta) en UTC. Por eso "hasta" se manda como la medianoche
// del día siguiente, y al mostrarlo se le resta ese día.
const dosDigitos = (n) => String(n).padStart(2, '0');

// "2026-10-20" → ISO UTC de la medianoche local de ese día (o del siguiente si fin = true).
export function diaAIso(yyyyMmDd, { fin = false } = {}) {
  if (!yyyyMmDd) return null;
  const [a, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(a, m - 1, d + (fin ? 1 : 0)).toISOString();
}

// Inverso de diaAIso: ISO de la API → "yyyy-MM-dd" para un <input type="date">.
export function isoADia(iso, { fin = false } = {}) {
  if (!iso) return '';
  const f = new Date(iso);
  if (fin) f.setDate(f.getDate() - 1);
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
}
