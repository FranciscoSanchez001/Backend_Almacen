// Arma un JWT de prueba (sin firma válida: el frontend solo lee el payload).
function base64url(objeto) {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function crearToken({ rol = 'ventas', nombre = 'Usuario de prueba', minutos = 60, ...extra } = {}) {
  const payload = {
    sub: '11111111-1111-4111-8111-111111111111',
    name: nombre,
    email: 'prueba@almacen.local',
    role: rol,
    exp: Math.floor(Date.now() / 1000) + minutos * 60,
    ...extra,
  }
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.firma`
}
