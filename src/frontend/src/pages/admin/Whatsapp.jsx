import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  desvincularWhatsapp,
  enviarPruebaWhatsapp,
  listarMensajesWhatsapp,
  obtenerEstadoWhatsapp,
  vincularWhatsapp,
} from '../../api/whatsapp'
import { obtenerConfiguracion } from '../../api/configuracion'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga } from '../../components/ui'
import { claseBoton, claseInput } from '../../utils/panel'
import { formatoFechaHora } from '../../utils/formato'

// Administración > WhatsApp. El gerente vincula aquí el teléfono que envía los avisos de los
// pedidos (compra aprobada y pedido en camino, de a uno): pulsa "Vincular", la
// pantalla muestra el QR y lo escanea desde WhatsApp > Dispositivos vinculados. Mientras espera el
// QR o la conexión, el estado se consulta cada 3 segundos.
const ESTADOS = {
  conectado: { texto: 'Conectado', clase: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  esperando_qr: { texto: 'Esperando escaneo', clase: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  conectando: { texto: 'Conectando…', clase: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  desconectado: { texto: 'Sin vincular', clase: 'bg-slate-100 text-slate-600' },
}

const ESTADOS_MENSAJE = {
  enviado: { texto: 'Enviado', clase: 'text-emerald-700 dark:text-emerald-300' },
  error: { texto: 'Error', clase: 'text-red-700 dark:text-red-300' },
  bloqueado_lista_blanca: { texto: 'Fuera de la lista de prueba', clase: 'text-amber-700 dark:text-amber-300' },
}

// Incluye plantillas que ya no se envían, para mostrar bien los mensajes viejos del registro.
const PLANTILLAS = {
  recibido: 'Recibido',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  expirado: 'Expirado',
  en_camino: 'En camino',
  entregado: 'Entregado',
}

const ESPERANDO = ['conectando', 'esperando_qr']

function EstadoSesion({ estado, ocupado, alVincular, alDesvincular }) {
  const info = ESTADOS[estado.estado] ?? ESTADOS.desconectado
  return (
    <section className="rounded-2xl border border-slate-200 bg-superficie p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Teléfono de la tienda</h3>
          <p className="text-sm text-slate-600">
            {estado.estado === 'conectado'
              ? `Vinculado: +${estado.numero}${estado.nombre ? ` · ${estado.nombre}` : ''}`
              : 'Es el número desde el que los clientes reciben los avisos de sus pedidos.'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${info.clase}`}>{info.texto}</span>
      </div>

      {estado.mensaje && (
        <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {estado.mensaje}
        </p>
      )}

      {estado.estado === 'esperando_qr' && estado.qr && (
        <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <img src={estado.qr} alt="Código QR para vincular WhatsApp" className="mx-auto h-64 w-64 max-w-full rounded-xl border border-slate-200 bg-white p-2" />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Abre WhatsApp en el teléfono de la tienda.</li>
            <li>
              Ve a <strong>Ajustes</strong> (o los tres puntos) → <strong>Dispositivos vinculados</strong>.
            </li>
            <li>
              Toca <strong>Vincular un dispositivo</strong> y escanea este código.
            </li>
            <li>El código cambia cada pocos segundos; esta pantalla se actualiza sola.</li>
          </ol>
        </div>
      )}

      {estado.estado === 'conectando' && <p className="mt-4 text-sm text-slate-500">Conectando con WhatsApp…</p>}

      {estado.configurado && estado.disponible && (
        <div className="mt-4 flex flex-wrap gap-2">
          {estado.estado === 'desconectado' && (
            <button type="button" onClick={alVincular} disabled={ocupado} className={claseBoton.primario}>
              {ocupado ? 'Generando código…' : 'Vincular teléfono'}
            </button>
          )}
          {estado.estado !== 'desconectado' && (
            <button type="button" onClick={alDesvincular} disabled={ocupado} className={claseBoton.secundario}>
              {estado.estado === 'conectado' ? 'Desvincular teléfono' : 'Cancelar'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function Prueba({ habilitado }) {
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setAviso(null)
    try {
      await enviarPruebaWhatsapp(telefono)
      setAviso({ tipo: 'ok', texto: `Mensaje de prueba enviado a ${telefono}.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-superficie p-5">
      <h3 className="font-semibold text-slate-900">Mensaje de prueba</h3>
      <p className="text-sm text-slate-600">Comprueba que el teléfono vinculado envía mensajes.</p>
      <form onSubmit={enviar} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Campo id="telefono-prueba" etiqueta="Teléfono">
            <input
              id="telefono-prueba"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+58 412 123 4567"
              className={claseInput()}
            />
          </Campo>
        </div>
        <button type="submit" disabled={!habilitado || enviando || !telefono.trim()} className={claseBoton.primario}>
          {enviando ? 'Enviando…' : 'Enviar prueba'}
        </button>
      </form>
      {!habilitado && <p className="mt-2 text-xs text-slate-500">Vincula un teléfono para poder enviar.</p>}
      <div className="mt-3">
        <Aviso aviso={aviso} />
      </div>
    </section>
  )
}

function ListaBlanca({ numeros }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <h3 className="font-semibold">Números de prueba</h3>
      <p className="mt-1">
        Mientras el sistema está en pruebas, los avisos de los pedidos <strong>solo se envían a estos números</strong>; los demás quedan
        registrados como “fuera de la lista de prueba”. Para recibirlos, agrega el teléfono que usas al comprar.
      </p>
      {numeros === null ? (
        <p className="mt-2">Cargando…</p>
      ) : numeros.length === 0 ? (
        <p className="mt-2 font-semibold">No hay números cargados: ningún cliente recibirá mensajes.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {numeros.map((n) => (
            <li key={n} className="rounded-full bg-white/70 px-3 py-0.5 font-mono text-xs dark:bg-black/20">
              {n}
            </li>
          ))}
        </ul>
      )}
      <Link to="/admin/configuracion" className="mt-3 inline-block font-semibold underline">
        Editar en Configuración
      </Link>
    </section>
  )
}

function Mensajes({ mensajes, alActualizar }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-superficie p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Últimos mensajes</h3>
          <p className="text-sm text-slate-600">Los avisos de los pedidos y si llegaron a enviarse.</p>
        </div>
        <button type="button" onClick={alActualizar} className={claseBoton.secundario}>
          Actualizar
        </button>
      </div>
      {mensajes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Todavía no hay mensajes.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {mensajes.map((m) => {
            const estado = ESTADOS_MENSAJE[m.estado] ?? { texto: m.estado, clase: 'text-slate-600' }
            return (
              <li key={m.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-slate-900">
                    Pedido #{m.numeroPedido} · {PLANTILLAS[m.plantilla] ?? m.plantilla}
                  </span>
                  <span className={`text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {m.telefono} · {formatoFechaHora(m.creadoEn)}
                </p>
                <p className="mt-1 break-words text-slate-700">{m.texto}</p>
                {m.error && <p className="mt-1 break-words text-xs text-red-700 dark:text-red-300">{m.error}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function Whatsapp() {
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [numeros, setNumeros] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [intento, setIntento] = useState(0)

  const cargarMensajes = useCallback(() => {
    listarMensajesWhatsapp()
      .then(setMensajes)
      .catch(() => {}) // La lista es informativa: si falla, el resto de la pantalla sigue.
  }, [])

  useEffect(() => {
    obtenerConfiguracion()
      .then((c) => setNumeros(c.numerosPrueba ?? []))
      .catch(() => setNumeros([]))
    cargarMensajes()
  }, [cargarMensajes])

  // Estado de la sesión: cada 3 s mientras se espera el QR o la conexión; si no, cada 15 s.
  const esperando = ESPERANDO.includes(estado?.estado)
  useEffect(() => {
    let vigente = true
    const consultar = () =>
      obtenerEstadoWhatsapp()
        .then((e) => {
          if (!vigente) return
          setEstado(e)
          setError('')
        })
        .catch((e) => vigente && setError(e.message))
    consultar()
    const t = setInterval(consultar, esperando ? 3000 : 15000)
    return () => {
      vigente = false
      clearInterval(t)
    }
  }, [esperando, intento])

  async function accion(fn) {
    setOcupado(true)
    try {
      setEstado(await fn())
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="WhatsApp" detalle="Vincula el teléfono que envía a los clientes los avisos de sus pedidos." />

      <EstadoCarga cargando={!estado && !error} error={!estado && error} alReintentar={() => setIntento((n) => n + 1)}>
        {estado && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {(!estado.configurado || !estado.disponible) && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {estado.mensaje}
                </p>
              )}
              {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
              <EstadoSesion
                estado={estado}
                ocupado={ocupado}
                alVincular={() => accion(vincularWhatsapp)}
                alDesvincular={() => accion(desvincularWhatsapp)}
              />
              <Prueba habilitado={estado.estado === 'conectado'} />
              <ListaBlanca numeros={numeros} />
            </div>
            <Mensajes mensajes={mensajes} alActualizar={cargarMensajes} />
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}
