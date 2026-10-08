// Auditoría (solo superadmin): cambios en productos/stock y cambios de estado de pedidos.
import { pedir } from './cliente';

export function listarCambios({ usuarioId, productoId, desde, hasta, pagina = 1, tamano = 25 } = {}) {
  return pedir('/auditoria', { consulta: { usuarioId, productoId, desde, hasta, pagina, tamano } });
}

export function listarCambiosPedidos({ usuarioId, desde, hasta, pagina = 1, tamano = 25 } = {}) {
  return pedir('/auditoria/pedidos', { consulta: { usuarioId, desde, hasta, pagina, tamano } });
}

// Todo el personal (incluido el gerente), para el filtro por usuario.
// /usuarios también lista clientes, así que se pide cada rol del personal por separado.
export async function listarPersonalCompleto() {
  const paginas = await Promise.all(
    ['superadmin', 'ventas', 'repartidor'].map((rol) => pedir('/usuarios', { consulta: { rol, tamano: 100 } })),
  );
  return paginas.flatMap((p) => p.items).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
