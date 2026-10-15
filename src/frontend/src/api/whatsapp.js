// WhatsApp de la tienda (solo superadmin): vincular el teléfono por QR, ver su estado, enviar una
// prueba y revisar los últimos mensajes. La API habla con el servicio de Baileys.
import { pedir } from './cliente';

// { configurado, disponible, estado: desconectado|conectando|esperando_qr|conectado, qr, numero, nombre, mensaje }
export function obtenerEstadoWhatsapp() {
  return pedir('/whatsapp/estado');
}

export function vincularWhatsapp() {
  return pedir('/whatsapp/vincular', { metodo: 'POST' });
}

export function desvincularWhatsapp() {
  return pedir('/whatsapp/desvincular', { metodo: 'POST' });
}

export function enviarPruebaWhatsapp(telefono) {
  return pedir('/whatsapp/prueba', { metodo: 'POST', cuerpo: { telefono } });
}

export function listarMensajesWhatsapp({ limite = 30 } = {}) {
  return pedir('/whatsapp/mensajes', { consulta: { limite } });
}
