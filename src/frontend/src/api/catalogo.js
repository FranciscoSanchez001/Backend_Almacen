// Catálogo público de la tienda (no pide sesión).
import { pedir } from './cliente';
import { sesionAnalitica } from '../utils/analitica';

// Productos activos con stock. Responde { items, total, numeroPagina, tamano }.
// Con ofertas=true, solo los que tienen una oferta vigente.
// Si la analítica está activa, se manda el id de la visita: la API registra la búsqueda (?q=)
// junto con cuántos resultados encontró.
export function listarCatalogo({ q, categoriaId, ofertas, pagina = 1, tamano = 24 } = {}) {
  const sesion = q?.trim() ? sesionAnalitica() : null;
  return pedir('/catalogo', {
    consulta: { q, categoriaId, ofertas: ofertas || undefined, pagina, tamano },
    encabezados: sesion ? { 'X-Sesion-Analitica': sesion } : undefined,
  });
}

// [{ id, nombre }] para el filtro por categorías.
export function listarCategorias() {
  return pedir('/categorias');
}

// Zonas de entrega activas para el checkout: [{ id, nombre }].
export function listarZonasEntrega() {
  return pedir('/catalogo/zonas');
}

// Datos para pagar (cuentas, pago móvil, wallet, tasa y soporte). Pide sesión de cliente.
export function obtenerDatosPago() {
  return pedir('/catalogo/pago');
}
