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

// --- Cliente (tienda) ---

// items: [{ productoId, cantidad }]. Devuelve subtotal, descuento y total con los precios
// vigentes; si el cupón no aplica, la API responde 400 con el motivo.
export function cotizarPedido({ items, codigoCupon }) {
  return pedir('/pedidos/cotizar', { metodo: 'POST', cuerpo: { items, codigoCupon: codigoCupon?.trim() || null } });
}

// multipart/form-data: la API espera items[0].productoId, items[0].cantidad... y la captura.
export function crearPedido({ items, metodoPago, referenciaPago, zonaId, direccionTexto, telefono, latitud, longitud, codigoCupon, captura }) {
  const datos = new FormData();
  items.forEach((it, i) => {
    datos.append(`items[${i}].productoId`, it.productoId);
    datos.append(`items[${i}].cantidad`, it.cantidad);
  });
  datos.append('metodoPago', metodoPago);
  datos.append('referenciaPago', referenciaPago.trim());
  datos.append('zonaId', zonaId);
  datos.append('direccionTexto', direccionTexto.trim());
  datos.append('telefono', telefono.trim());
  if (latitud != null && longitud != null) {
    datos.append('latitud', latitud);
    datos.append('longitud', longitud);
  }
  if (codigoCupon?.trim()) datos.append('codigoCupon', codigoCupon.trim());
  datos.append('captura', captura);
  return pedir('/pedidos', { metodo: 'POST', cuerpo: datos });
}

export function listarMisPedidos({ pagina = 1, tamano = 10 } = {}) {
  return pedir('/pedidos/mios', { consulta: { pagina, tamano } });
}

export function obtenerPedido(id) {
  return pedir(`/pedidos/${id}`);
}
