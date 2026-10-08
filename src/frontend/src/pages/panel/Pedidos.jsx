import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  aprobarPedido,
  listarPedidos,
  listarRepartidores,
  marcarEnCamino,
  marcarEntregado,
  rechazarPedido,
} from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import DetallePedido from '../../components/DetallePedido'
import ContadorExpiracion from '../../components/ContadorExpiracion'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga, EtiquetaEstado, Paginacion, Selector } from '../../components/ui'
import { ESTADOS_PEDIDO, METODOS_PAGO, claseBoton, claseInput } from '../../utils/panel'
import { formatoBs, formatoFechaHora, formatoUsd } from '../../utils/formato'

// Bandeja de pedidos del personal. "Pendientes" es la bandeja de trabajo (los más
// cerca de vencer primero); el resto de pestañas es el seguimiento.
// Aprobar exige elegir repartidor; rechazar lleva un motivo (por defecto el de la API).
// Pasar a "en camino" o "entregado" lo hace el repartidor; del personal, solo el gerente.
const TAMANO = 20
const PESTANAS = ['pendiente', 'asignado', 'en_camino', 'entregado', 'rechazado', 'expirado'].map((e) => [
  e,
  ESTADOS_PEDIDO[e].nombre,
])
const MOTIVO_POR_DEFECTO = 'El método de pago no procede.'

function TarjetaPedido({ pedido, alAbrir }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => alAbrir(pedido)}
        className="w-full rounded-xl border border-slate-200 bg-superficie p-4 text-left transition hover:border-marca-200 dark:hover:border-marca-500 hover:shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              Pedido #{pedido.numero} <span className="font-normal text-slate-500">· {pedido.cliente?.nombre}</span>
            </p>
            <p className="text-xs text-slate-500">
              {formatoFechaHora(pedido.creadoEn)} · {pedido.zona?.nombre} · {METODOS_PAGO[pedido.metodoPago]}
            </p>
          </div>
          {pedido.estado === 'pendiente' ? <ContadorExpiracion expiraEn={pedido.expiraEn} /> : <EtiquetaEstado estado={pedido.estado} />}
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm text-slate-600">
            {pedido.items.length} {pedido.items.length === 1 ? 'producto' : 'productos'}
            {pedido.repartidor && ` · ${pedido.repartidor.nombre}`}
          </p>
          <p className="text-right">
            <span className="font-bold text-slate-900">{formatoUsd(pedido.totalUsd)}</span>
            <span className="block text-xs text-slate-500">{formatoBs(pedido.totalBs)}</span>
          </p>
        </div>
      </button>
    </li>
  )
}

// Acciones según el estado del pedido y el rol de quien lo ve.
function AccionesPedido({ pedido, alTerminar }) {
  const { tieneRol } = useAuth()
  const [modo, setModo] = useState(null) // null | 'aprobar' | 'rechazar'
  const [repartidores, setRepartidores] = useState(null)
  const [repartidorId, setRepartidorId] = useState('')
  const [motivo, setMotivo] = useState(MOTIVO_POR_DEFECTO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (modo !== 'aprobar' || repartidores) return
    listarRepartidores()
      .then(setRepartidores)
      .catch((e) => setError(e.message))
  }, [modo, repartidores])

  async function ejecutar(accion, textoOk) {
    setEnviando(true)
    setError('')
    try {
      const actualizado = await accion()
      alTerminar(actualizado, textoOk)
    } catch (e) {
      setError(e.message)
      setEnviando(false)
    }
  }

  const n = pedido.numero
  let contenido = null

  if (pedido.estado === 'pendiente') {
    if (modo === 'aprobar') {
      contenido = (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ejecutar(() => aprobarPedido(pedido.id, repartidorId), `Pedido #${n} aprobado y asignado.`)
          }}
          className="space-y-3"
        >
          <Campo id="repartidor" etiqueta="Repartidor que lo entregará">
            <select
              id="repartidor"
              required
              value={repartidorId}
              onChange={(e) => setRepartidorId(e.target.value)}
              className={claseInput()}
              disabled={!repartidores}
            >
              <option value="">{repartidores ? 'Elige un repartidor' : 'Cargando repartidores…'}</option>
              {repartidores?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} · {r.pedidosEnCurso} en curso
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setModo(null)} className={claseBoton.secundario}>
              Volver
            </button>
            <button type="submit" disabled={enviando || !repartidorId} className={claseBoton.primario}>
              {enviando ? 'Aprobando…' : 'Aprobar y asignar'}
            </button>
          </div>
        </form>
      )
    } else if (modo === 'rechazar') {
      contenido = (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ejecutar(() => rechazarPedido(pedido.id, motivo), `Pedido #${n} rechazado. El stock volvió a la tienda.`)
          }}
          className="space-y-3"
        >
          <Campo id="motivo" etiqueta="Motivo del rechazo" ayuda="Queda guardado en el pedido.">
            <textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={claseInput()} />
          </Campo>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setModo(null)} className={claseBoton.secundario}>
              Volver
            </button>
            <button type="submit" disabled={enviando} className={claseBoton.peligro}>
              {enviando ? 'Rechazando…' : 'Rechazar pedido'}
            </button>
          </div>
        </form>
      )
    } else {
      contenido = (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setModo('rechazar')} className={claseBoton.secundario}>
            Rechazar
          </button>
          <button type="button" onClick={() => setModo('aprobar')} className={claseBoton.primario}>
            Aprobar
          </button>
        </div>
      )
    }
  } else if (tieneRol('superadmin') && pedido.estado === 'asignado') {
    contenido = (
      <div className="flex justify-end">
        <button
          type="button"
          disabled={enviando}
          onClick={() => ejecutar(() => marcarEnCamino(pedido.id), `Pedido #${n} en camino.`)}
          className={claseBoton.primario}
        >
          {enviando ? 'Guardando…' : 'Marcar en camino'}
        </button>
      </div>
    )
  } else if (tieneRol('superadmin') && pedido.estado === 'en_camino') {
    contenido = (
      <div className="flex justify-end">
        <button
          type="button"
          disabled={enviando}
          onClick={() => ejecutar(() => marcarEntregado(pedido.id), `Pedido #${n} entregado.`)}
          className={claseBoton.primario}
        >
          {enviando ? 'Guardando…' : 'Marcar entregado'}
        </button>
      </div>
    )
  }

  if (!contenido) return null
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {contenido}
    </div>
  )
}

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') ?? 'pendiente'
  const pagina = Number(params.get('pagina')) || 1

  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setResultado(await listarPedidos({ estado, pagina, tamano: TAMANO }))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [estado, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const cerrar = useCallback(() => setAbierto(null), [])

  // Tras aprobar, rechazar o avanzar: el pedido sale de esta pestaña.
  function alTerminar(actualizado, texto) {
    setAbierto(null)
    setAviso({ tipo: 'ok', texto })
    setResultado((r) => r && { ...r, items: r.items.filter((p) => p.id !== actualizado.id), total: r.total - 1 })
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Pedidos" detalle="Revisa los pagos, aprueba asignando un repartidor y sigue cada entrega.">
        <button type="button" onClick={cargar} className={claseBoton.secundario}>
          Actualizar
        </button>
      </EncabezadoPagina>

      <Aviso aviso={aviso} />

      <div className="flex flex-wrap items-center gap-3">
        <Selector etiqueta="Estado" opciones={PESTANAS} valor={estado} alCambiar={(e) => setParams({ estado: e })} />
        {resultado && !cargando && <p className="text-xs text-slate-500">{resultado.total} pedidos</p>}
      </div>

      <EstadoCarga
        cargando={cargando}
        error={error}
        alReintentar={cargar}
        vacio={resultado?.items.length === 0}
        textoVacio={estado === 'pendiente' ? '¡Todo al día! No hay pedidos por revisar.' : 'No hay pedidos en este estado.'}
      >
        <ul className="grid gap-3 lg:grid-cols-2">
          {resultado?.items.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} alAbrir={setAbierto} />
          ))}
        </ul>
        <Paginacion
          pagina={pagina}
          total={resultado?.total ?? 0}
          tamano={TAMANO}
          alCambiar={(n) => setParams({ estado, pagina: n })}
        />
      </EstadoCarga>

      <Modal abierto={abierto !== null} titulo={abierto ? `Pedido #${abierto.numero}` : ''} alCerrar={cerrar} ancho="sm:max-w-3xl">
        {abierto && (
          <DetallePedido pedido={abierto}>
            <AccionesPedido key={abierto.id} pedido={abierto} alTerminar={alTerminar} />
          </DetallePedido>
        )}
      </Modal>
    </div>
  )
}
