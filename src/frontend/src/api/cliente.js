// Único punto por donde el frontend habla con la API de Backend_Almacen.

const URL_API = import.meta.env.VITE_API_URL;
const CLAVE_TOKEN = 'almacen.token';

// Mensajes por defecto cuando la API no explica el error.
const MENSAJES = {
  401: 'Tu sesión venció o no tienes acceso. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No se encontró lo que buscas.',
  503: 'El servicio no está disponible en este momento.',
};

// --- Token de sesión (se guarda en el navegador) ---

export function guardarToken(token) {
  if (token) localStorage.setItem(CLAVE_TOKEN, token);
  else localStorage.removeItem(CLAVE_TOKEN);
}

export function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

// --- Error propio: además del mensaje, guarda el código HTTP (404, 409...) ---

export class ErrorApi extends Error {
  constructor(mensaje, estado, datos) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.datos = datos;
  }
}

async function crearError(respuesta) {
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // La respuesta no traía cuerpo.
  }
  // El backend responde { mensaje } o, si fallan las validaciones, { title, errors }.
  const errores = datos?.errors ? Object.values(datos.errors).flat() : [];
  const mensaje =
    datos?.mensaje ?? errores[0] ?? MENSAJES[respuesta.status] ?? datos?.title ?? 'Ocurrió un error inesperado.';
  return new ErrorApi(mensaje, respuesta.status, datos);
}

// --- La función que usan todas las pantallas ---

export async function pedir(ruta, { metodo = 'GET', cuerpo, consulta } = {}) {
  // 1. Dirección completa + filtros (?q=harina&pagina=1). Se omiten los vacíos.
  const url = new URL(ruta, URL_API);
  if (consulta) {
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
    }
  }

  // 2. Token de sesión, si hay.
  const encabezados = {};
  const token = obtenerToken();
  if (token) encabezados.Authorization = `Bearer ${token}`;

  // 3. Cuerpo: archivos (FormData) tal cual; lo demás, como JSON.
  let body;
  if (cuerpo instanceof FormData) {
    body = cuerpo; // El navegador pone el Content-Type correcto.
  } else if (cuerpo !== undefined) {
    body = JSON.stringify(cuerpo);
    encabezados['Content-Type'] = 'application/json';
  }

  // 4. Llamada. Si ni siquiera se pudo conectar, el error es de red.
  let respuesta;
  try {
    respuesta = await fetch(url, { method: metodo, headers: encabezados, body });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. Revisa que la API esté encendida.', 0, null);
  }

  // 5. Sesión vencida: se borra el token y se avisa al resto de la app.
  if (respuesta.status === 401 && token) {
    guardarToken(null);
    window.dispatchEvent(new Event('sesion-expirada'));
  }

  // 6. Errores → ErrorApi con un mensaje legible.
  if (!respuesta.ok) throw await crearError(respuesta);

  // 7. Respuesta: vacía, JSON o archivo (el Excel llega como archivo).
  if (respuesta.status === 204) return null;
  const tipo = respuesta.headers.get('Content-Type') ?? '';
  return tipo.includes('application/json') ? respuesta.json() : respuesta.blob();
}

// Archivos que guarda la API (p. ej. capturas de pago). En desarrollo llegan como
// ruta relativa (/uploads/...); con Cloudinary ya vienen como URL completa.
export function urlArchivo(ruta) {
  if (!ruta) return null;
  return /^https?:\/\//.test(ruta) ? ruta : new URL(ruta, URL_API).href;
}
