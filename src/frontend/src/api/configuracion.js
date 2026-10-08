// Configuración del sistema y zonas de entrega (solo superadmin).
import { pedir } from './cliente';

export function obtenerConfiguracion() {
  return pedir('/configuracion');
}

// { numeroSoporte, horasExpiracion, datosTransferencia, datosPagoMovil, walletBinance, numerosPrueba }
export function guardarConfiguracion(datos) {
  return pedir('/configuracion', { metodo: 'PUT', cuerpo: datos });
}

export function cargarTasa(tasa) {
  return pedir('/configuracion/tasa', { metodo: 'PUT', cuerpo: { tasa } });
}

export function historialTasas({ pagina = 1, tamano = 10 } = {}) {
  return pedir('/configuracion/tasas', { consulta: { pagina, tamano } });
}

export function listarZonas() {
  return pedir('/zonas');
}

export function crearZona(nombre) {
  return pedir('/zonas', { metodo: 'POST', cuerpo: { nombre } });
}

export function actualizarZona(id, { nombre, activa }) {
  return pedir(`/zonas/${id}`, { metodo: 'PUT', cuerpo: { nombre, activa } });
}
