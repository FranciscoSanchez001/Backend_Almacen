import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { claveValida, crearServidor } from '../src/servidor.js'
import { ErrorEnvio, normalizarTelefono } from '../src/sesion.js'

// Sesión simulada: el servidor solo traduce HTTP ↔ sesión.
const enviados = []
const sesion = {
  resumen: () => ({ estado: 'conectado', qr: null, numero: '584121234567', nombre: 'Almacén', mensaje: null }),
  iniciar: async () => ({ estado: 'esperando_qr', qr: 'data:image/png;base64,AAA' }),
  desvincular: async () => ({ estado: 'desconectado' }),
  enviar: async (telefono, texto) => {
    if (telefono === '000') throw new ErrorEnvio('El teléfono no es válido.', 400)
    enviados.push({ telefono, texto })
    return { id: 'ABC', numero: telefono }
  },
}
const logger = { error() {} }
let servidor
let base

before(async () => {
  servidor = crearServidor({ sesion, apiKey: 'secreta', logger })
  await new Promise((r) => servidor.listen(0, r))
  base = `http://127.0.0.1:${servidor.address().port}`
})
after(() => servidor.close())

const pedir = (ruta, { metodo = 'GET', clave = 'secreta', cuerpo } = {}) =>
  fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(clave ? { 'X-Api-Key': clave } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })

describe('servidor de WhatsApp', () => {
  it('/salud responde sin clave', async () => {
    assert.equal((await pedir('/salud', { clave: null })).status, 200)
  })

  it('exige la clave en el resto de rutas', async () => {
    assert.equal((await pedir('/estado', { clave: null })).status, 401)
    assert.equal((await pedir('/estado', { clave: 'otra' })).status, 401)
  })

  it('devuelve el estado de la sesión', async () => {
    const r = await pedir('/estado')
    assert.equal(r.status, 200)
    assert.equal((await r.json()).estado, 'conectado')
  })

  it('vincular devuelve el QR', async () => {
    const r = await pedir('/vincular', { metodo: 'POST' })
    assert.equal((await r.json()).estado, 'esperando_qr')
  })

  it('envía un mensaje', async () => {
    const r = await pedir('/enviar', { metodo: 'POST', cuerpo: { telefono: '584121234567', texto: 'Hola' } })
    assert.equal(r.status, 200)
    assert.deepEqual(enviados.at(-1), { telefono: '584121234567', texto: 'Hola' })
  })

  it('traduce los errores de envío a su código HTTP', async () => {
    const r = await pedir('/enviar', { metodo: 'POST', cuerpo: { telefono: '000', texto: 'Hola' } })
    assert.equal(r.status, 400)
    assert.equal((await r.json()).error, 'El teléfono no es válido.')
  })

  it('rechaza un cuerpo que no es JSON', async () => {
    const r = await fetch(base + '/enviar', { method: 'POST', headers: { 'X-Api-Key': 'secreta' }, body: '{malo' })
    assert.equal(r.status, 400)
  })

  it('ruta desconocida → 404', async () => {
    assert.equal((await pedir('/nada')).status, 404)
  })
})

describe('utilidades', () => {
  it('normaliza teléfonos venezolanos', () => {
    assert.equal(normalizarTelefono('+58 412-123.4567'), '584121234567')
    assert.equal(normalizarTelefono('04121234567'), '584121234567')
  })

  it('sin clave configurada acepta cualquier petición', () => {
    assert.equal(claveValida(undefined, undefined), true)
    assert.equal(claveValida('x', 'secreta'), false)
  })
})
