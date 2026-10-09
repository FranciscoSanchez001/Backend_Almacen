// Avisos del personal: producto agotado, pedido nuevo y pedido por expirar.
import { pedir } from './cliente';

export function listarNotificaciones({ soloNoLeidas = true } = {}) {
  return pedir('/notificaciones', { consulta: { soloNoLeidas } });
}

export function marcarLeida(id) {
  return pedir(`/notificaciones/${id}/leer`, { metodo: 'POST' });
}

export function marcarTodasLeidas() {
  return pedir('/notificaciones/leer-todas', { metodo: 'POST' });
}
