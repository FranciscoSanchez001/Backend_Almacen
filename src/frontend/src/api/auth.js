// Autenticación del personal contra Backend_Almacen (POST /auth/login).
// Las pantallas no usan esto directo: pasan por AuthContext, que decodifica el token.
import { pedir, guardarToken } from './cliente';

const CLAVE_REFRESH = 'almacen.refresh';

// Pantalla de inicio de cada rol del personal.
export const INICIO_POR_ROL = {
  superadmin: '/admin',
  ventas: '/panel',
  repartidor: '/repartidor',
};

export async function login({ correo, clave }) {
  const sesion = await pedir('/auth/login', {
    metodo: 'POST',
    cuerpo: { email: correo.trim(), password: clave },
  });
  guardarSesion(sesion);
  return sesion;
}

export async function loginGoogle(idToken) {
  const sesion = await pedir('/auth/google', {
    metodo: 'POST',
    cuerpo: { idToken },
  });
  guardarSesion(sesion);
  return sesion;
}

function guardarSesion(sesion) {
  guardarToken(sesion.token);
  localStorage.setItem(CLAVE_REFRESH, sesion.refreshToken);
}

// Cierra la sesión: revoca el refresh token en la API y borra todo del navegador.
// Si la API no responde, igual se cierra la sesión localmente.
export async function cerrarSesion() {
  const refreshToken = localStorage.getItem(CLAVE_REFRESH);
  if (refreshToken) {
    try {
      await pedir('/auth/logout', { metodo: 'POST', cuerpo: { refreshToken } });
    } catch {
      // Se ignora: lo importante es limpiar la sesión del navegador.
    }
  }
  guardarToken(null);
  localStorage.removeItem(CLAVE_REFRESH);
  localStorage.removeItem('almacen.usuario'); // Lo guardaban versiones anteriores.
  window.google?.accounts?.id?.disableAutoSelect();
}
