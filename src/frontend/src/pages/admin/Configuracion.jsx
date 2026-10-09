import { useCallback, useEffect, useState } from 'react'
import {
  actualizarZona,
  cargarTasa,
  crearZona,
  guardarConfiguracion,
  historialTasas,
  listarZonas,
  obtenerConfiguracion,
} from '../../api/configuracion'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga } from '../../components/ui'
import { claseBoton, claseInput, erroresPorCampo } from '../../utils/panel'
import { formatoFechaHora } from '../../utils/formato'

// Configuración del sistema (solo gerente): tasa del día y su historial, zonas de
// entrega, número de soporte, datos de pago y horas para que un pedido expire.
function Tarjeta({ titulo, detalle, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-superficie p-5">
      <div>
        <h3 className="font-semibold text-slate-900">{titulo}</h3>
        {detalle && <p className="text-sm text-slate-500">{detalle}</p>}
      </div>
      {children}
    </section>
  )
}

function Tasa({ actual, alCambiar, avisar }) {
  const [tasa, setTasa] = useState('')
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargarHistorial = useCallback(() => {
    historialTasas({ tamano: 8 })
      .then((r) => setHistorial(r.items))
      .catch(() => setHistorial([]))
  }, [])

  useEffect(cargarHistorial, [cargarHistorial])

  async function alEnviar(e) {
    e.preventDefault()
    const n = Number(tasa)
    if (!(n > 0)) return setError('Escribe una tasa mayor que 0.')
    setGuardando(true)
    try {
      await cargarTasa(n)
      setTasa('')
      cargarHistorial()
      alCambiar()
      avisar({ tipo: 'ok', texto: `Tasa del día actualizada a ${n} Bs/USD.` })
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta titulo="Tasa del día (Bs/USD)" detalle="Sin tasa, la tienda no acepta pedidos. Los pedidos guardan la tasa del momento en que se crean.">
      <p className="text-3xl font-bold text-slate-900">{actual ? `${actual} Bs` : 'Sin cargar'}</p>
      <form onSubmit={alEnviar} className="flex items-start gap-2">
        <div className="flex-1">
          <Campo id="tasa" etiqueta="Nueva tasa" error={error}>
            <input
              id="tasa"
              type="number"
              min="0"
              step="0.0001"
              value={tasa}
              onChange={(e) => {
                setTasa(e.target.value)
                setError('')
              }}
              className={claseInput(error)}
            />
          </Campo>
        </div>
        <button type="submit" disabled={guardando} className={`${claseBoton.primario} mt-6 shrink-0`}>
          {guardando ? 'Guardando…' : 'Cargar tasa'}
        </button>
      </form>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Historial</p>
        <ul className="divide-y divide-slate-100 text-sm">
          {historial?.map((t) => (
            <li key={t.id} className="flex justify-between py-1.5">
              <span className="font-medium">{t.tasa} Bs</span>
              <span className="text-xs text-slate-500">
                {formatoFechaHora(t.creadoEn)} · {t.usuario}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Tarjeta>
  )
}

function Zonas({ avisar }) {
  const [zonas, setZonas] = useState(null)
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    listarZonas()
      .then((z) => setZonas(z.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(cargar, [cargar])

  async function ejecutar(accion, texto) {
    setError('')
    try {
      await accion()
      setNueva('')
      setEditando(null)
      cargar()
      avisar({ tipo: 'ok', texto })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Tarjeta titulo="Zonas de entrega" detalle="El cliente elige una al pagar. Una zona desactivada deja de aparecer en la tienda.">
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {zonas?.map((z) => (
          <li key={z.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editando?.id === z.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  ejecutar(() => actualizarZona(z.id, { nombre: editando.nombre.trim(), activa: z.activa }), 'Zona renombrada.')
                }}
              >
                <input aria-label="Nombre de la zona" autoFocus value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={claseInput()} />
                <button type="submit" disabled={!editando.nombre.trim()} className={claseBoton.pequeno}>
                  Guardar
                </button>
                <button type="button" onClick={() => setEditando(null)} className={claseBoton.pequeno}>
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className={`flex-1 ${z.activa ? 'text-slate-800' : 'text-slate-400'}`}>
                  {z.nombre} {!z.activa && '(inactiva)'}
                </span>
                <button type="button" onClick={() => setEditando({ id: z.id, nombre: z.nombre })} className={claseBoton.pequeno}>
                  Renombrar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    ejecutar(() => actualizarZona(z.id, { nombre: z.nombre, activa: !z.activa }), `${z.nombre} quedó ${z.activa ? 'inactiva' : 'activa'}.`)
                  }
                  className={claseBoton.pequeno}
                >
                  {z.activa ? 'Desactivar' : 'Activar'}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          ejecutar(() => crearZona(nueva.trim()), `Se agregó la zona ${nueva.trim()}.`)
        }}
      >
        <input aria-label="Nombre de la nueva zona" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva zona" className={claseInput()} />
        <button type="submit" disabled={!nueva.trim()} className={`${claseBoton.primario} shrink-0`}>
          Agregar
        </button>
      </form>
    </Tarjeta>
  )
}

function Generales({ config, alGuardar, avisar }) {
  const [d, setD] = useState({
    numeroSoporte: config.numeroSoporte ?? '',
    horasExpiracion: config.horasExpiracion ?? 5,
    datosTransferencia: config.datosTransferencia ?? '',
    datosPagoMovil: config.datosPagoMovil ?? '',
    walletBinance: config.walletBinance ?? '',
    numerosPrueba: (config.numerosPrueba ?? []).join('\n'),
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, valor) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }))
  }

  async function alEnviar(e) {
    e.preventDefault()
    const horas = Number(d.horasExpiracion)
    if (!Number.isInteger(horas) || horas < 1 || horas > 168) return setErrores({ horasExpiracion: 'Entre 1 y 168 horas.' })
    setGuardando(true)
    try {
      await guardarConfiguracion({
        numeroSoporte: d.numeroSoporte.trim() || null,
        horasExpiracion: horas,
        datosTransferencia: d.datosTransferencia.trim() || null,
        datosPagoMovil: d.datosPagoMovil.trim() || null,
        walletBinance: d.walletBinance.trim() || null,
        numerosPrueba: d.numerosPrueba.split(/[\n,]/).map((n) => n.trim()).filter(Boolean),
      })
      alGuardar()
      avisar({ tipo: 'ok', texto: 'Configuración guardada.' })
    } catch (err) {
      setErrores(erroresPorCampo(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta titulo="Soporte, pagos y expiración" detalle="Los datos de pago son los que ve el cliente en el paso 1 del checkout.">
      <form onSubmit={alEnviar} noValidate className="space-y-4">
        {errores.general && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{errores.general}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="soporte" etiqueta="Número de soporte" error={errores.numeroSoporte} ayuda="Va en los mensajes de rechazo, expiración y entrega.">
            <input id="soporte" value={d.numeroSoporte} onChange={(e) => cambiar('numeroSoporte', e.target.value)} placeholder="+58 424 700 0000" className={claseInput(errores.numeroSoporte)} />
          </Campo>
          <Campo id="horas" etiqueta="Horas para que un pedido expire" error={errores.horasExpiracion} ayuda="5 por defecto.">
            <input id="horas" type="number" min="1" max="168" value={d.horasExpiracion} onChange={(e) => cambiar('horasExpiracion', e.target.value)} className={claseInput(errores.horasExpiracion)} />
          </Campo>
        </div>
        <Campo id="transferencia" etiqueta="Datos de transferencia" error={errores.datosTransferencia}>
          <textarea id="transferencia" rows={2} value={d.datosTransferencia} onChange={(e) => cambiar('datosTransferencia', e.target.value)} className={claseInput(errores.datosTransferencia)} />
        </Campo>
        <Campo id="pagoMovil" etiqueta="Datos de pago móvil" error={errores.datosPagoMovil}>
          <textarea id="pagoMovil" rows={2} value={d.datosPagoMovil} onChange={(e) => cambiar('datosPagoMovil', e.target.value)} className={claseInput(errores.datosPagoMovil)} />
        </Campo>
        <Campo id="binance" etiqueta="Wallet de Binance" error={errores.walletBinance}>
          <input id="binance" value={d.walletBinance} onChange={(e) => cambiar('walletBinance', e.target.value)} className={claseInput(errores.walletBinance)} />
        </Campo>
        <Campo id="prueba" etiqueta="Números de prueba de WhatsApp" error={errores.numerosPrueba} ayuda="Uno por línea (hasta 20). Solo a estos números se envían mensajes.">
          <textarea id="prueba" rows={3} value={d.numerosPrueba} onChange={(e) => cambiar('numerosPrueba', e.target.value)} className={`${claseInput(errores.numerosPrueba)} font-mono`} />
        </Campo>
        <div className="flex justify-end">
          <button type="submit" disabled={guardando} className={claseBoton.primario}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Tarjeta>
  )
}

export default function Configuracion() {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(() => {
    setError('')
    obtenerConfiguracion()
      .then(setConfig)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(cargar, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Configuración" detalle="Parámetros que usan la tienda, el checkout y los mensajes de WhatsApp." />
      <Aviso aviso={aviso} />
      <EstadoCarga cargando={!config && !error} error={error} alReintentar={cargar}>
        {config && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Tasa actual={config.tasaBsUsd} alCambiar={cargar} avisar={setAviso} />
              <Zonas avisar={setAviso} />
            </div>
            <Generales config={config} alGuardar={cargar} avisar={setAviso} />
          </div>
        )}
      </EstadoCarga>
    </div>
  )
}
