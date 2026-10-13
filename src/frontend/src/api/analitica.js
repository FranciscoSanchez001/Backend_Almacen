// Resumen de comportamiento de la tienda (solo superadmin). El registro de eventos está en
// utils/analitica.js.
import { pedir } from './cliente';

// Mismos períodos que /kpis: tipo diario | semanal | mensual | personalizado, fechas yyyy-MM-dd.
export function obtenerComportamiento({ tipo, desde, hasta } = {}) {
  return pedir('/analitica/comportamiento', { consulta: { tipo, desde, hasta } });
}
