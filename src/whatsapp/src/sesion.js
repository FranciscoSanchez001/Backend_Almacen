// Sesión de WhatsApp con Baileys: un solo teléfono vinculado por QR, que es el que envía los
// mensajes de los pedidos. Las credenciales quedan en CARPETA_SESION (un volumen de Docker), así
// que al reiniciar el contenedor no hay que volver a escanear el QR.
//
// Estados:
//   desconectado  no hay teléfono vinculado (o se desvinculó); se vincula con iniciar()
//   conectando    abriendo la conexión con WhatsApp
//   esperando_qr  hay un QR para escanear desde WhatsApp > Dispositivos vinculados
//   conectado     listo para enviar
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
} from 'baileys'
import pino from 'pino'
import QRCode from 'qrcode'

export class ErrorEnvio extends Error {
  constructor(mensaje, estadoHttp) {
    super(mensaje)
    this.estadoHttp = estadoHttp
  }
}

// "+58 412-123.4567" → "584121234567". Un número local venezolano ("0412…") se pasa a +58.
export function normalizarTelefono(telefono) {
  let digitos = String(telefono ?? '').replace(/\D/g, '')
  if (digitos.startsWith('0') && digitos.length === 11) digitos = `58${digitos.slice(1)}`
  return digitos
}

export class SesionWhatsapp {
  constructor({ carpeta, logger = pino({ level: 'silent' }), reintentoMs = 3000 }) {
    this.carpeta = carpeta
    this.logger = logger
    this.reintentoMs = reintentoMs
    this.socket = null
    this.estado = { estado: 'desconectado', qr: null, numero: null, nombre: null, mensaje: null }
  }

  // Hay credenciales guardadas de una vinculación anterior.
  get vinculado() {
    return existsSync(join(this.carpeta, 'creds.json'))
  }

  resumen() {
    return { ...this.estado }
  }

  cambiar(cambios) {
    this.estado = { ...this.estado, ...cambios }
    this.logger.info?.({ estado: this.estado.estado }, 'whatsapp')
  }

  // Abre la conexión. Sin credenciales, WhatsApp manda un QR (estado esperando_qr); con ellas,
  // se reconecta directo. Llamarlo con una conexión abierta no hace nada.
  async iniciar() {
    if (this.socket) return this.resumen()
    this.detenido = false
    this.cambiar({ estado: 'conectando', qr: null, mensaje: null })

    const { state, saveCreds } = await useMultiFileAuthState(this.carpeta)
    let version
    try {
      ;({ version } = await fetchLatestBaileysVersion())
    } catch {
      // Sin internet para consultar la versión, Baileys usa la que trae incluida.
    }

    const socket = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, this.logger) },
      logger: this.logger,
      browser: Browsers.ubuntu('Almacén'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    })
    this.socket = socket
    socket.ev.on('creds.update', saveCreds)
    socket.ev.on('connection.update', (u) => this.alActualizar(socket, u))
    return this.resumen()
  }

  async alActualizar(socket, { connection, lastDisconnect, qr }) {
    if (socket !== this.socket) return // Eventos de una conexión vieja.

    if (qr) {
      this.cambiar({ estado: 'esperando_qr', qr: await QRCode.toDataURL(qr, { margin: 1, width: 320 }), mensaje: null })
    }

    if (connection === 'open') {
      const usuario = socket.user ?? {}
      this.cambiar({
        estado: 'conectado',
        qr: null,
        numero: usuario.id ? jidDecode(usuario.id)?.user ?? null : null,
        nombre: usuario.name ?? usuario.verifiedName ?? null,
        mensaje: null,
      })
    }

    if (connection === 'close') {
      this.socket = null
      const codigo = lastDisconnect?.error?.output?.statusCode
      const esperabaQr = this.estado.estado === 'esperando_qr' && !this.vinculado

      if (codigo === DisconnectReason.loggedOut) {
        // Se desvinculó desde el teléfono: se borran las credenciales para poder volver a vincular.
        await rm(this.carpeta, { recursive: true, force: true })
        this.cambiar({ estado: 'desconectado', qr: null, numero: null, nombre: null, mensaje: 'El teléfono se desvinculó.' })
      } else if (this.detenido) {
        this.cambiar({ estado: 'desconectado', qr: null })
      } else if (esperabaQr && codigo === DisconnectReason.timedOut) {
        // Nadie escaneó los QR a tiempo: no se sigue generando QR en segundo plano.
        this.cambiar({ estado: 'desconectado', qr: null, mensaje: 'El código QR venció. Vuelve a generarlo.' })
      } else {
        // Caída de red, reinicio pedido por WhatsApp tras vincular (515), etc.: se reconecta.
        this.cambiar({ estado: 'conectando', qr: null })
        setTimeout(() => this.iniciar().catch((e) => this.cambiar({ estado: 'desconectado', mensaje: e.message })), this.reintentoMs)
      }
    }
  }

  // Cierra la sesión en WhatsApp (el dispositivo desaparece del teléfono) y borra las credenciales.
  async desvincular() {
    this.detenido = true
    const socket = this.socket
    this.socket = null
    if (socket) {
      try {
        await socket.logout()
      } catch {
        socket.end?.(undefined)
      }
    }
    await rm(this.carpeta, { recursive: true, force: true })
    this.cambiar({ estado: 'desconectado', qr: null, numero: null, nombre: null, mensaje: null })
    return this.resumen()
  }

  async enviar(telefono, texto) {
    if (!texto || !String(texto).trim()) throw new ErrorEnvio('Falta el texto del mensaje.', 400)
    const numero = normalizarTelefono(telefono)
    if (numero.length < 10) throw new ErrorEnvio('El teléfono no es válido.', 400)
    if (!this.socket || this.estado.estado !== 'conectado') {
      throw new ErrorEnvio('WhatsApp no está vinculado. Vincula un teléfono desde Administración > WhatsApp.', 503)
    }

    const [existe] = await this.socket.onWhatsApp(numero)
    if (!existe?.exists) throw new ErrorEnvio(`El número +${numero} no tiene WhatsApp.`, 404)

    const enviado = await this.socket.sendMessage(existe.jid, { text: String(texto) })
    return { id: enviado?.key?.id ?? null, numero }
  }
}
