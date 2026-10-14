// Entregas (repartidor). Pensado para el celular: una tarjeta por pedido con lo necesario para
// llegar (dirección, mapa, teléfono) y un solo botón grande con el siguiente paso:
//   asignado  → "Salí a entregar"   (POST /pedidos/{id}/en-camino)
//   en camino → "Marcar entregado"  (POST /pedidos/{id}/entregado, con confirmación)
// En cada paso la API le avisa al cliente por WhatsApp. "Historial" lista sus entregas hechas.
import { useCallback, useEffect, useState } from 'react'
import { listarMisEntregas } from '../../api/repartidor'
import { marcarEnCamino, marcarEntregado } from '../../api/pedidos'
import { Aviso, EstadoCarga, EtiquetaEstado, Paginacion, Selector } from '../../components/ui'
import Icono from '../../components/Icono'
import { claseBoton } from '../../utils/panel'
import { formatoBs, formatoFechaHora, formatoUsd } from '../../utils/formato'

const VISTAS = [
  ['pendientes', 'Por entregar'],
  ['historial', 'Historial'],
]
const TAMANO = 20

// Enlaces de navegación: con coordenadas, al punto exacto; si no, se busca la dirección escrita.
function enlacesMapa(p) {
  if (p.latitud != null && p.longitud != null) {
    const ll = `${p.latitud},${p.longitud}`
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    }
  }
  const q = encodeURIComponent(`${p.direccionTexto}, ${p.zona?.nombre ?? ''}`)
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  }
}

// +58 412 123 4567 → 584121234567 (formato de wa.me).
const soloDigitos = (telefono) => (telefono ?? '').replace(/\D/g, '')

function TarjetaEntrega({ pedido, alAvanzar, ocupado }) {
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const mapa = enlacesMapa(pedido)
  const unidades = pedido.items.reduce((s, it) => s + it.cantidad, 0)
  const enCamino = pedido.estado === 'en_camino'
  const entregado = pedido.estado === 'entregado'
  const enlace = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'

  return (
    <article aria-label={`Pedido #${pedido.numero}`} className="min-w-0 rounded-2xl border border-slate-200 bg-superficie p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">Pedido #{pedido.numero}</h3>
          <p className="text-xs text-slate-500">
            {entregado
              ? `Entregado el ${formatoFechaHora(pedido.entregadoEn)}`
              : `Asignado el ${formatoFechaHora(pedido.asignadoEn ?? pedido.creadoEn)}`}
          </p>
        </div>
        <EtiquetaEstado estado={pedido.estado} />
      </header>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dirección</dt>
          <dd className="break-words font-medium text-slate-900">
            {pedido.direccionTexto}
            <span className="block text-slate-600">{pedido.zona?.nombre}</span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</dt>
            <dd className="text-slate-900">{pedido.cliente?.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</dt>
            <dd className="text-slate-900">
              {formatoUsd(pedido.totalUsd)} <span className="text-xs text-slate-500">({formatoBs(pedido.totalBs)}) · ya pagado</span>
            </dd>
          </div>
        </div>
      </dl>

      {!entregado && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={mapa.google} target="_blank" rel="noreferrer" className={enlace}>
            Google Maps <Icono nombre="externo" className="h-3.5 w-3.5" />
          </a>
          <a href={mapa.waze} target="_blank" rel="noreferrer" className={enlace}>
            Waze <Icono nombre="externo" className="h-3.5 w-3.5" />
          </a>
          <a href={`tel:${pedido.telefonoContacto}`} className={enlace} aria-label={`Llamar al ${pedido.telefonoContacto}`}>
            Llamar
          </a>
          <a
            href={`https://wa.me/${soloDigitos(pedido.telefonoContacto)}`}
            target="_blank"
            rel="noreferrer"
            className={enlace}
            aria-label={`Escribir por WhatsApp al ${pedido.telefonoContacto}`}
          >
            WhatsApp
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="mt-3 text-sm font-medium text-marca-700 hover:underline dark:text-marca-200"
      >
        {abierto ? 'Ocultar productos' : `Ver productos (${unidades} ${unidades === 1 ? 'unidad' : 'unidades'})`}
      </button>
      {abierto && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {pedido.items.map((it) => (
            <li key={it.productoId} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 break-words text-slate-800">{it.producto}</span>
              <span className="shrink-0 font-semibold">× {it.cantidad}</span>
            </li>
          ))}
        </ul>
      )}

      {!entregado && (
        <div className="mt-4">
          {!enCamino ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => alAvanzar(pedido, 'en_camino')}
              className={`${claseBoton.primario} w-full py-3 text-base`}
            >
              <Icono nombre="moto" className="mr-2 h-5 w-5 align-[-4px]" />
              Salí a entregar
            </button>
          ) : confirmando ? (
            <div role="group" aria-label="Confirmar entrega" className="space-y-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                ¿Entregaste el pedido #{pedido.numero}? Esta acción no se puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmando(false)} className={`${claseBoton.secundario} w-full`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => alAvanzar(pedido, 'entregado')}
                  className={`${claseBoton.primario} w-full`}
                >
                  Sí, entregado
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setConfirmando(true)}
              className={`${claseBoton.primario} w-full py-3 text-base`}
            >
              <Icono nombre="check" className="mr-2 h-5 w-5 align-[-4px]" />
              Marcar entregado
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export default function Inicio() {
  const [vista, setVista] = useState('pendientes')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(null) // id del pedido que se está actualizando
  const [aviso, setAviso] = useState(null)
  const historial = vista === 'historial'

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setDatos(await listarMisEntregas({ historial, pagina, tamano: TAMANO }))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [historial, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las asignaciones nuevas llegan solas: se vuelve a consultar cada minuto.
  useEffect(() => {
    if (historial) return
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [cargar, historial])

  function cambiarVista(v) {
    setVista(v)
    setPagina(1)
    setAviso(null)
  }

  async function avanzar(pedido, estado) {
    setOcupado(pedido.id)
    setAviso(null)
    try {
      if (estado === 'en_camino') {
        await marcarEnCamino(pedido.id)
        setAviso({ tipo: 'ok', texto: `Pedido #${pedido.numero} en camino. Le avisamos al cliente por WhatsApp.` })
      } else {
        await marcarEntregado(pedido.id)
        setAviso({ tipo: 'ok', texto: `Pedido #${pedido.numero} entregado. ¡Buen trabajo!` })
      }
      await cargar()
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message })
    } finally {
      setOcupado(null)
    }
  }

  const items = datos?.items ?? []
  const enCamino = items.filter((p) => p.estado === 'en_camino').length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            Entregas <Icono nombre="moto" className="h-8 w-8" grosor={1.6} tono />
          </h2>
          {!historial && datos && (
            <p className="text-sm text-slate-600">
              {datos.total === 0 ? 'No tienes pedidos asignados.' : `${datos.total} por entregar${enCamino ? ` · ${enCamino} en camino` : ''}`}
            </p>
          )}
        </div>
        <button type="button" onClick={cargar} disabled={cargando} className={claseBoton.secundario} aria-label="Actualizar lista">
          {cargando && datos ? 'Actualizando…' : 'Actualizar'}
        </button>
      </section>

      <Selector etiqueta="Vista" opciones={VISTAS} valor={vista} alCambiar={cambiarVista} />
      <Aviso aviso={aviso} />

      <EstadoCarga
        cargando={cargando && !datos}
        error={!datos && error}
        vacio={datos && items.length === 0}
        textoVacio={historial ? 'Todavía no has hecho entregas.' : 'No tienes pedidos por entregar. Cuando ventas te asigne uno, aparecerá aquí.'}
        alReintentar={cargar}
      >
        <div className={`space-y-3 ${cargando ? 'opacity-60' : ''}`}>
          {items.map((p) => (
            <TarjetaEntrega key={p.id} pedido={p} alAvanzar={avanzar} ocupado={ocupado === p.id} />
          ))}
        </div>
        {datos && <Paginacion pagina={pagina} total={datos.total} tamano={TAMANO} alCambiar={setPagina} />}
      </EstadoCarga>
    </div>
  )
}
