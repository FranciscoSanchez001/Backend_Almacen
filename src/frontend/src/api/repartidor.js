// Área del repartidor. Los cambios de estado (en camino, entregado) están en api/pedidos.js.
import { pedir } from './cliente';

// historial=false: sus pedidos por entregar (asignados y en camino), primero los más antiguos.
// historial=true: sus entregas ya hechas, las más recientes primero.
export function listarMisEntregas({ historial = false, pagina = 1, tamano = 20 } = {}) {
  return pedir('/repartidor/pedidos', { consulta: { historial, pagina, tamano } });
}
