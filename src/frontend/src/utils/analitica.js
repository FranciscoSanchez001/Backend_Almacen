// Analítica de comportamiento de la tienda (POST /analitica/eventos). Anónima: cada visita tiene
// un id aleatorio que vence tras 30 minutos sin actividad; no se envían datos personales.
// Los eventos se juntan y se mandan por lotes cada pocos segundos, o al salir de la página.
// Está apagada hasta que main.jsx llama a activarAnalitica(), y no se activa si el navegador
// pide "No rastrear". Nada de esto puede romper la tienda: cualquier error se ignora.
import { obtenerToken } from '../api/cliente';

const CLAVE_SESION = 'almacen.analitica';
const INACTIVIDAD_MS = 30 * 60 * 1000;
const ESPERA_MS = 5000;
const LOTE_MAXIMO = 20; // La API acepta hasta 50.

let activa = false;
let cola = [];
let temporizador = null;

export function activarAnalitica() {
  if (activa || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  activa = true;
  // Al cambiar de pestaña o cerrar, se manda lo pendiente (keepalive deja terminar la petición).
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && enviarEventos());
  window.addEventListener('pagehide', enviarEventos);
}

// Solo para las pruebas.
export function desactivarAnalitica() {
  activa = false;
  cola = [];
  clearTimeout(temporizador);
  temporizador = null;
}

function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // randomUUID solo existe en HTTPS o localhost.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Id de la visita actual (o null si la analítica está apagada). Cada uso renueva el vencimiento.
export function sesionAnalitica() {
  if (!activa) return null;
  try {
    const ahora = Date.now();
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION) ?? 'null');
    const id = guardada && ahora - guardada.ultimo < INACTIVIDAD_MS ? guardada.id : nuevoId();
    localStorage.setItem(CLAVE_SESION, JSON.stringify({ id, ultimo: ahora }));
    return id;
  } catch {
    return null;
  }
}

// tipo: pagina_vista | filtro_categoria | filtro_ofertas | abrir_carrito | agregar_carrito |
// quitar_carrito | inicio_checkout | cupon_aplicado | cupon_rechazado | pedido_confirmado.
// datos: { ruta, productoId, categoriaId, texto, cantidad, valor } según el tipo.
export function registrarEvento(tipo, datos = {}) {
  if (!activa) return;
  cola.push({ tipo, ...datos });
  if (cola.length >= LOTE_MAXIMO) enviarEventos();
  else temporizador ??= setTimeout(enviarEventos, ESPERA_MS);
}

export function enviarEventos() {
  clearTimeout(temporizador);
  temporizador = null;
  const sesionId = sesionAnalitica();
  if (!sesionId || cola.length === 0) return;

  const eventos = cola.splice(0, LOTE_MAXIMO);
  const encabezados = { 'Content-Type': 'application/json' };
  const token = obtenerToken();
  if (token) encabezados.Authorization = `Bearer ${token}`;
  try {
    fetch(new URL('/analitica/eventos', import.meta.env.VITE_API_URL), {
      method: 'POST',
      headers: encabezados,
      body: JSON.stringify({ sesionId, eventos }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Sin red o sin fetch: se pierden estos eventos y la tienda sigue.
  }
  if (cola.length > 0) temporizador = setTimeout(enviarEventos, ESPERA_MS);
}
