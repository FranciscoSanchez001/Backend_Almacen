// KPIs del dashboard e informe en Excel (solo superadmin).
// Ambos salen del mismo cálculo en la API, así que siempre coinciden.
import { pedir } from './cliente';

// tipo: diario | semanal | mensual | personalizado. Fechas yyyy-MM-dd, inclusive.
export function obtenerKpis({ tipo, desde, hasta } = {}) {
  return pedir('/kpis', { consulta: { tipo, desde, hasta } });
}

// Descarga el .xlsx. El nombre sigue la especificación: informe_ventas_2026-09_mensual.xlsx
export async function descargarExcel({ tipo, desde, hasta }) {
  const archivo = await pedir('/reportes/excel', { consulta: { tipo, desde, hasta } });
  const marca = tipo === 'mensual' ? desde.slice(0, 7) : tipo === 'personalizado' ? `${desde}_a_${hasta}` : desde;
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `informe_ventas_${marca}_${tipo}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
