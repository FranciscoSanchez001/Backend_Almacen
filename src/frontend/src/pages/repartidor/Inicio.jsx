import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listarMisEntregas } from '../../api/repartidor'
import { marcarEnCamino, marcarEntregado } from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import Icono from '../../components/Icono'
import { Aviso, EstadoCarga, EtiquetaEstado, Paginacion, Selector } from '../../components/ui'
import { claseBoton } from '../../utils/panel'
import { formatoFechaHora, formatoUsd } from '../../utils/formato'
import { enlaceMapa } from '../../utils/entregas'

// Entregas del repartidor, pensado para el celular. Cada tarjeta trae todo lo necesario y su
// único botón es el siguiente paso, sin abrir otra pantalla:
//   asignado  → "Iniciar entrega"         (POST /pedidos/{id}/en-camino; el cliente recibe un WhatsApp)
//   en camino → "Marcar como entregado"   (POST /pedidos/{id}/entregado; sale de la lista)
// "Historial" muestra las entregas ya hechas, sin acciones.
const TAMANO = 20
const VISTAS = [['activas', 'Entregas en curso'], ['historial', 'Historial']]

function TarjetaEntrega({ pedido, historial, enviando, alAvanzar }) {
  const [verProductos, setVerProductos] = useState(false)
  const unidades = pedido.items.reduce((suma, item) => suma + item.cantidad, 0)
  const enCamino = pedido.estado === 'en_camino'
  const enlace = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'

  return (
    <article aria-label={`Pedido #${pedido.numero}`} className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-superficie p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold">Pedido #{pedido.numero}</span>
        <EtiquetaEstado estado={pedido.estado} />
      </div>
      <p className="mt-3 font-semibold">{pedido.cliente.nombre}</p>
      <p className="mt-1 break-words text-sm text-slate-600">
        {pedido.zona.nombre} · {pedido.direccionTexto}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {formatoUsd(pedido.totalUsd)} ya pagado · {historial ? 'Entregado' : 'Asignado'} el{' '}
        {formatoFechaHora((historial ? pedido.entregadoEn : pedido.asignadoEn) ?? pedido.creadoEn)}
      </p>

      {!historial && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={enlaceMapa(pedido)} target="_blank" rel="noreferrer" className={enlace}>
            Google Maps <Icono nombre="externo" className="h-3.5 w-3.5" />
          </a>
          <a href={`tel:${pedido.telefonoContacto}`} className={enlace} aria-label={`Llamar al ${pedido.telefonoContacto}`}>
            Llamar
          </a>
          <a
            href={`https://wa.me/${pedido.telefonoContacto.replace(/\D/g, '')}`}
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
        onClick={() => setVerProductos((v) => !v)}
        aria-expanded={verProductos}
        className="mt-3 self-start text-sm font-medium text-marca-700 hover:underline dark:text-marca-200"
      >
        {verProductos ? 'Ocultar productos' : `Ver productos (${unidades} ${unidades === 1 ? 'unidad' : 'unidades'})`}
      </button>
      {verProductos && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {pedido.items.map((item) => (
            <li key={item.productoId} className="flex justify-between gap-3 px-3 py-2">
              <span className="min-w-0 break-words">{item.producto}</span>
              <span className="shrink-0 font-semibold">× {item.cantidad}</span>
            </li>
          ))}
        </ul>
      )}

      {!historial && (
        <div className="mt-auto pt-4">
          <button
            type="button"
            disabled={enviando}
            onClick={() => alAvanzar(pedido, enCamino ? 'entregado' : 'en_camino')}
            className={`${claseBoton.primario} w-full py-3 text-base`}
          >
            {enviando ? 'Guardando…' : enCamino ? 'Marcar como entregado' : 'Iniciar entrega'}
          </button>
        </div>
      )}
    </article>
  )
}

export default function Inicio() {
  const { usuario } = useAuth()
  const [params, setParams] = useSearchParams()
  const historial = params.get('vista') === 'historial'
  const numeroPagina = Number(params.get('pagina') ?? 1)
  const pagina = Number.isSafeInteger(numeroPagina) && numeroPagina > 0 ? numeroPagina : 1
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(null) // id del pedido que se está guardando
  const bloqueado = useRef(false)

  useEffect(() => {
    if (usuario?.rol !== 'repartidor') return
    let activo = true
    setCargando(true)
    setError('')
    listarMisEntregas({ historial, pagina, tamano: TAMANO })
      .then((datos) => {
        if (!activo) return
        const ultimaPagina = Math.max(1, Math.ceil(datos.total / TAMANO))
        if (pagina > ultimaPagina) {
          setParams({ vista: historial ? 'historial' : 'activas', pagina: String(ultimaPagina) }, { replace: true })
          return
        }
        setResultado(datos)
      })
      .catch((err) => {
        if (activo) setError(err.message)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [usuario?.id, usuario?.rol, historial, pagina, intento, setParams])

  // Las asignaciones nuevas aparecen solas: se vuelve a consultar cada minuto.
  useEffect(() => {
    if (historial || usuario?.rol !== 'repartidor') return
    const intervalo = setInterval(() => setIntento((actual) => actual + 1), 60000)
    return () => clearInterval(intervalo)
  }, [historial, usuario?.rol])

  function cambiarVista(vista) {
    setResultado(null)
    setAviso(null)
    setParams({ vista })
  }

  async function avanzar(pedido, estado) {
    if (bloqueado.current) return // Evita un doble toque mientras se guarda.
    bloqueado.current = true
    setEnviando(pedido.id)
    setAviso(null)
    try {
      const actualizado = await (estado === 'en_camino' ? marcarEnCamino(pedido.id) : marcarEntregado(pedido.id))
      setAviso({
        tipo: 'ok',
        texto:
          actualizado.estado === 'entregado'
            ? `Pedido #${actualizado.numero} entregado.`
            : `Pedido #${actualizado.numero} en camino. Le avisamos al cliente por WhatsApp.`,
      })
      // Se refleja de inmediato en la tarjeta y luego se confirma con el servidor.
      setResultado((r) => r && { ...r, items: r.items.map((p) => (p.id === actualizado.id ? { ...p, ...actualizado } : p)) })
    } catch (err) {
      // Si otro cambió el pedido (409) o ya no es suyo (404), la lista se actualiza.
      setAviso({ tipo: 'error', texto: err.message })
    } finally {
      bloqueado.current = false
      setEnviando(null)
      setIntento((actual) => actual + 1)
    }
  }

  if (usuario?.rol !== 'repartidor')
    return (
      <section className="rounded-2xl border border-slate-200 bg-superficie p-6">
        <h2 className="text-2xl font-bold">Entregas</h2>
        <p className="mt-3 text-slate-600">
          Las entregas de cada repartidor se consultan con su cuenta. Desde el panel puedes gestionar todos los pedidos y sus estados.
        </p>
        <Link to="/panel/pedidos" className={`mt-4 inline-block ${claseBoton.primario}`}>
          Ir a pedidos
        </Link>
      </section>
    )

  const items = resultado?.items ?? []
  const activas = items.filter((p) => p.estado !== 'entregado')

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            Entregas <Icono nombre="moto" />
          </h2>
          <p className="mt-1 text-sm text-slate-500">Tus pedidos asignados: inicia la entrega y márcala como entregada al llegar.</p>
        </div>
        <button type="button" onClick={() => setIntento((actual) => actual + 1)} disabled={cargando} className={claseBoton.secundario}>
          Actualizar
        </button>
      </div>
      <Aviso aviso={aviso} />
      <Selector etiqueta="Entregas" opciones={VISTAS} valor={historial ? 'historial' : 'activas'} alCambiar={cambiarVista} />
      {resultado && (
        <p className="text-sm text-slate-500">
          {historial ? `${resultado.total} entregas realizadas` : `${activas.length} ${activas.length === 1 ? 'entrega en curso' : 'entregas en curso'}`}
        </p>
      )}
      <EstadoCarga
        cargando={cargando && !resultado}
        error={!resultado && error}
        alReintentar={() => setIntento((actual) => actual + 1)}
        vacio={resultado && (historial ? items : activas).length === 0}
        textoVacio={historial ? 'Todavía no tienes entregas realizadas.' : 'No tienes pedidos pendientes de entrega.'}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {(historial ? items : activas).map((pedido) => (
            <li key={pedido.id}>
              <TarjetaEntrega pedido={pedido} historial={historial} enviando={enviando === pedido.id} alAvanzar={avanzar} />
            </li>
          ))}
        </ul>
        <Paginacion
          pagina={pagina}
          total={resultado?.total ?? 0}
          tamano={TAMANO}
          alCambiar={(n) => setParams({ vista: historial ? 'historial' : 'activas', pagina: String(n) })}
        />
      </EstadoCarga>
    </div>
  )
}
