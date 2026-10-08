// Inventario: stock disponible/reservado, reposición y movimientos.
import { pedir } from './cliente';

export function listarInventario({ q, categoriaId, soloAgotados } = {}) {
  return pedir('/inventario', { consulta: { q, categoriaId, soloAgotados } });
}

export function reponer(productoId, cantidad) {
  return pedir(`/inventario/${productoId}/reponer`, { metodo: 'POST', cuerpo: { cantidad } });
}

export function listarMovimientos(productoId, { pagina = 1, tamano = 20 } = {}) {
  return pedir(`/inventario/${productoId}/movimientos`, { consulta: { pagina, tamano } });
}
