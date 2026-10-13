// Cupones de descuento (solo superadmin).
import { pedir } from './cliente';

export function listarCupones({ q, activo, pagina = 1, tamano = 50 } = {}) {
  return pedir('/cupones', { consulta: { q, activo, pagina, tamano } });
}

export function crearCupon(datos) {
  return pedir('/cupones', { metodo: 'POST', cuerpo: datos });
}

// El código no se puede cambiar: la API lo ignora al editar.
export function actualizarCupon(id, datos) {
  return pedir(`/cupones/${id}`, { metodo: 'PUT', cuerpo: datos });
}
