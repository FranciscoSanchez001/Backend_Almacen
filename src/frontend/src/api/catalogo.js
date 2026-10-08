// Catálogo público de la tienda (no pide sesión).
import { pedir } from './cliente';

// Productos activos con stock. Responde { items, total, numeroPagina, tamano }.
export function listarCatalogo({ q, categoriaId, pagina = 1, tamano = 24 } = {}) {
  return pedir('/catalogo', { consulta: { q, categoriaId, pagina, tamano } });
}

// [{ id, nombre }] para el filtro por categorías.
export function listarCategorias() {
  return pedir('/categorias');
}
