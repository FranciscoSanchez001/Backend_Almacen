// Servicio HTTP de WhatsApp. Lo usa solo la API (.NET), nunca el navegador: no se publica fuera de
// la red de Docker y, si se define API_KEY, exige el encabezado X-Api-Key.
//
//   GET  /salud         200 si el proceso está vivo (healthcheck; sin clave)
//   GET  /estado        { estado, qr, numero, nombre, mensaje }
//   POST /vincular      abre la conexión; si no hay teléfono vinculado aparece el QR en /estado
//   POST /desvincular   cierra la sesión en WhatsApp y borra las credenciales
//   POST /enviar        { telefono, texto } → 200 { id, numero } | 400 | 404 | 503
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import pino from 'pino'
import { ErrorEnvio, SesionWhatsapp } from './sesion.js'

const MAX_CUERPO = 64 * 1024

export function claveValida(recibida, esperada) {
  if (!esperada) return true
  if (typeof recibida !== 'string') return false
  const a = Buffer.from(recibida)
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(cuerpo))
}

async function leerJson(req) {
  let datos = ''
  for await (const parte of req) {
    datos += parte
    if (datos.length > MAX_CUERPO) throw new ErrorEnvio('El cuerpo es demasiado grande.', 413)
  }
  if (!datos) return {}
  try {
    return JSON.parse(datos)
  } catch {
    throw new ErrorEnvio('El cuerpo no es JSON válido.', 400)
  }
}

export function crearServidor({ sesion, apiKey, logger }) {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://servicio')
    const ruta = `${req.method} ${pathname}`
    try {
      if (ruta === 'GET /salud') return responder(res, 200, { ok: true })
      if (!claveValida(req.headers['x-api-key'], apiKey)) return responder(res, 401, { error: 'Clave inválida.' })

      switch (ruta) {
        case 'GET /estado':
          return responder(res, 200, sesion.resumen())
        case 'POST /vincular':
          return responder(res, 200, await sesion.iniciar())
        case 'POST /desvincular':
          return responder(res, 200, await sesion.desvincular())
        case 'POST /enviar': {
          const { telefono, texto } = await leerJson(req)
          return responder(res, 200, await sesion.enviar(telefono, texto))
        }
        default:
          return responder(res, 404, { error: 'Ruta no encontrada.' })
      }
    } catch (e) {
      if (e instanceof ErrorEnvio) return responder(res, e.estadoHttp, { error: e.message })
      logger.error({ err: e, ruta }, 'error en el servicio de WhatsApp')
      return responder(res, 500, { error: 'Error interno del servicio de WhatsApp.' })
    }
  })
}

// Arranque (no se ejecuta al importarlo desde las pruebas).
if (process.argv[1]?.endsWith('servidor.js')) {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
  const sesion = new SesionWhatsapp({
    carpeta: process.env.CARPETA_SESION ?? './sesion',
    logger: logger.child({ modulo: 'baileys', level: 'warn' }),
  })
  const puerto = Number(process.env.PUERTO ?? 3001)
  crearServidor({ sesion, apiKey: process.env.API_KEY, logger }).listen(puerto, () =>
    logger.info(`Servicio de WhatsApp en el puerto ${puerto}`),
  )
  // Si ya hay un teléfono vinculado de antes, se reconecta solo.
  if (sesion.vinculado) sesion.iniciar().catch((e) => logger.error(e, 'no se pudo reconectar WhatsApp'))
}
