// Productos y categorías (gestión del personal).
import { pedir } from './cliente';

export function listarProductos({ q, categoriaId, incluirInactivos, pagina = 1, tamano = 50 } = {}) {
  return pedir('/productos', { consulta: { q, categoriaId, incluirInactivos, pagina, tamano } });
}

// Todos los productos activos, recorriendo las páginas (100 es el máximo de la API).
export async function listarTodosLosProductos() {
  const productos = [];
  for (let pagina = 1; ; pagina++) {
    const p = await listarProductos({ pagina, tamano: 100 });
    productos.push(...p.items);
    if (productos.length >= p.total || p.items.length === 0) return productos;
  }
}

export function crearProducto(datos) {
  return pedir('/productos', { metodo: 'POST', cuerpo: datos });
}

export function actualizarProducto(id, datos) {
  return pedir(`/productos/${id}`, { metodo: 'PUT', cuerpo: datos });
}

// Borrado lógico. Solo superadmin (a ventas la API le responde 403).
export function borrarProducto(id) {
  return pedir(`/productos/${id}`, { metodo: 'DELETE' });
}

export function listarCategorias() {
  return pedir('/categorias');
}

// Crear y renombrar categorías: solo superadmin.
export function crearCategoria(nombre) {
  return pedir('/categorias', { metodo: 'POST', cuerpo: { nombre } });
}

export function renombrarCategoria(id, nombre) {
  return pedir(`/categorias/${id}`, { metodo: 'PUT', cuerpo: { nombre } });
}
