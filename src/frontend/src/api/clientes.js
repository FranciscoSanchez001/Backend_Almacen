// Historial de compras de los clientes (personal).
import { pedir } from './cliente';

// buscar: nombre, correo o teléfono.
export function buscarClientes({ buscar, pagina = 1, tamano = 20 } = {}) {
  return pedir('/clientes', { consulta: { buscar, pagina, tamano } });
}

export function pedidosDeCliente(id, { pagina = 1, tamano = 10 } = {}) {
  return pedir(`/clientes/${id}/pedidos`, { consulta: { pagina, tamano } });
}
