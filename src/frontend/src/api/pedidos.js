// Pedidos: bandeja del personal, aprobar/rechazar y seguimiento.
import { pedir } from './cliente';

// estado: pendiente | asignado | en_camino | entregado | rechazado | expirado.
// Con estado=pendiente la API ordena primero los más cerca de vencer.
export function listarPedidos({ estado, zonaId, pagina = 1, tamano = 20 } = {}) {
  return pedir('/pedidos', { consulta: { estado, zonaId, pagina, tamano } });
}

export function listarRepartidores() {
  return pedir('/pedidos/repartidores');
}

export function aprobarPedido(id, repartidorId) {
  return pedir(`/pedidos/${id}/aprobar`, { metodo: 'POST', cuerpo: { repartidorId } });
}

// Sin motivo, la API usa "el método de pago no procede".
export function rechazarPedido(id, motivo) {
  return pedir(`/pedidos/${id}/rechazar`, { metodo: 'POST', cuerpo: { motivo: motivo?.trim() || null } });
}

// Solo repartidor y superadmin.
export function marcarEnCamino(id) {
  return pedir(`/pedidos/${id}/en-camino`, { metodo: 'POST' });
}

export function marcarEntregado(id) {
  return pedir(`/pedidos/${id}/entregado`, { metodo: 'POST' });
}
