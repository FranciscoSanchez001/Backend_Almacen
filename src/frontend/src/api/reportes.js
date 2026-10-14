// KPIs del dashboard e informes en Excel y PDF (solo superadmin).
// Ambos salen del mismo cálculo en la API, así que siempre coinciden.
import { pedir } from './cliente';

// tipo: diario | semanal | mensual | personalizado. Fechas yyyy-MM-dd, inclusive.
export function obtenerKpis({ tipo, desde, hasta } = {}) {
  return pedir('/kpis', { consulta: { tipo, desde, hasta } });
}

// Nombre según la especificación: informe_ventas_2026-09_mensual.xlsx (el PDF: dashboard_kpi_…).
function marcaPeriodo({ tipo, desde, hasta }) {
  const marca = tipo === 'mensual' ? desde.slice(0, 7) : tipo === 'personalizado' ? `${desde}_a_${hasta}` : desde;
  return `${marca}_${tipo}`;
}

async function descargar(ruta, nombre, { tipo, desde, hasta }) {
  const archivo = await pedir(ruta, { consulta: { tipo, desde, hasta } });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// Descarga el .xlsx con el detalle completo del período.
export function descargarExcel(periodo) {
  return descargar('/reportes/excel', `informe_ventas_${marcaPeriodo(periodo)}.xlsx`, periodo);
}

// Descarga el PDF del dashboard (KPIs + comportamiento de los visitantes) del mismo período.
export function descargarPdf(periodo) {
  return descargar('/reportes/pdf', `dashboard_kpi_${marcaPeriodo(periodo)}.pdf`, periodo);
}
