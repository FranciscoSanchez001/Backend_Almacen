// Avisos del personal (notificaciones): cómo se muestra cada tipo y cómo se entera el resto de
// la pantalla cuando alguien los marca como leídos (la campana y el Resumen los muestran a la vez).

const TIPOS_AVISO = {
  stock_agotado: { icono: 'agotado', texto: (n) => `Se agotó ${n.producto ?? 'un producto'}` },
  pedido_nuevo: { icono: 'carrito', texto: () => 'Llegó un pedido nuevo' },
  pedido_por_expirar: { icono: 'reloj', texto: () => 'Un pedido está por expirar' },
}

export function tipoAviso(aviso) {
  return TIPOS_AVISO[aviso.tipo] ?? { icono: 'campana', texto: () => aviso.tipo }
}

export const EVENTO_AVISOS = 'almacen:avisos-cambiaron'

export function avisarCambioAvisos() {
  window.dispatchEvent(new Event(EVENTO_AVISOS))
}
