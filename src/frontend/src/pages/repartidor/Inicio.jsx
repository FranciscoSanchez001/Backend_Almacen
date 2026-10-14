import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listarMisEntregas } from '../../api/repartidor'
import { useAuth } from '../../context/AuthContext'
import Icono from '../../components/Icono'
import { Aviso, EstadoCarga, EtiquetaEstado, Paginacion, Selector } from '../../components/ui'
import { claseBoton } from '../../utils/panel'
import { formatoFechaHora } from '../../utils/formato'
import DetalleEntrega from './DetalleEntrega'

const TAMANO = 20
const VISTAS = [['activas', 'Mis entregas'], ['historial', 'Historial']]

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
  const [seleccionado, setSeleccionado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const cerrarDetalle = useCallback(() => setSeleccionado(null), [])

  useEffect(() => {
    if (usuario?.rol !== 'repartidor') return
    let activo = true
    setCargando(true)
    setResultado(null)
    setError('')
    listarMisEntregas({ historial, pagina, tamano: TAMANO }).then(datos => {
      if (!activo) return
      const ultimaPagina = Math.max(1, Math.ceil(datos.total / TAMANO))
      if (pagina > ultimaPagina) { setParams({ vista: historial ? 'historial' : 'activas', pagina: String(ultimaPagina) }, { replace: true }); return }
      setResultado(datos)
    }).catch(err => { if (activo) setError(err.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [usuario?.id, usuario?.rol, historial, pagina, intento, setParams])

  // Conserva la actualización automática de nuevas asignaciones.
  useEffect(() => {
    if (historial || usuario?.rol !== 'repartidor') return
    const intervalo = setInterval(() => setIntento(actual => actual + 1), 60000)
    return () => clearInterval(intervalo)
  }, [historial, usuario?.rol])

  function cambiarVista(vista) {
    setSeleccionado(null)
    setParams({ vista })
  }

  function alActualizar(pedido, texto) {
    setAviso({ tipo: 'ok', texto })
    if (pedido.estado === 'entregado') setSeleccionado(null)
    setIntento(actual => actual + 1)
  }

  if (usuario?.rol !== 'repartidor') return <section className="rounded-2xl border border-slate-200 bg-superficie p-6"><h2 className="text-2xl font-bold">Entregas</h2><p className="mt-3 text-slate-600">Las entregas de cada repartidor se consultan con su cuenta. Desde el panel puedes gestionar todos los pedidos y sus estados.</p><Link to="/panel/pedidos" className={`mt-4 inline-block ${claseBoton.primario}`}>Ir a pedidos</Link></section>

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold">Entregas <Icono nombre="moto" /></h2><p className="mt-1 text-sm text-slate-500">Tus pedidos asignados, dirección y seguimiento de cada entrega.</p></div>
        <button type="button" onClick={() => setIntento(actual => actual + 1)} disabled={cargando} className={claseBoton.secundario}>Actualizar</button>
      </div>
      <Aviso aviso={aviso} />
      <Selector etiqueta="Entregas" opciones={VISTAS} valor={historial ? 'historial' : 'activas'} alCambiar={cambiarVista} />
      {resultado && <p className="text-sm text-slate-500">{resultado.total} {historial ? 'entregas realizadas' : 'entregas en curso'}</p>}
      <EstadoCarga cargando={cargando} error={error} alReintentar={() => setIntento(actual => actual + 1)} vacio={resultado?.items.length === 0}
        textoVacio={historial ? 'Todavía no tienes entregas realizadas.' : 'No tienes pedidos pendientes de entrega.'}>
        <ul className="grid gap-3 sm:grid-cols-2">{resultado?.items.map(pedido => <li key={pedido.id}>
          <button type="button" onClick={() => setSeleccionado(pedido.id)} aria-label={`Ver pedido #${pedido.numero}`}
            className="h-full w-full rounded-2xl border border-slate-200 bg-superficie p-5 text-left transition hover:border-marca-500 hover:shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">Pedido #{pedido.numero}</span><EtiquetaEstado estado={pedido.estado} /></div>
            <p className="mt-3 font-semibold">{pedido.cliente.nombre}</p><p className="mt-1 text-sm text-slate-600">{pedido.zona.nombre} · {pedido.direccionTexto}</p>
            <p className="mt-3 text-xs text-slate-500">{pedido.items.reduce((suma, item) => suma + item.cantidad, 0)} unidades · {historial ? 'Entregado' : 'Asignado'} el {formatoFechaHora((historial ? pedido.entregadoEn : pedido.asignadoEn) ?? pedido.creadoEn)}</p>
            <span className="mt-4 block text-sm font-medium text-marca-700 dark:text-marca-200">Ver detalle y {historial ? 'recorrido' : 'acciones'}</span>
          </button>
        </li>)}</ul>
        <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={TAMANO}
          alCambiar={n => setParams({ vista: historial ? 'historial' : 'activas', pagina: String(n) })} />
      </EstadoCarga>
      {seleccionado && <DetalleEntrega key={seleccionado} pedidoId={seleccionado} alCerrar={cerrarDetalle} alActualizar={alActualizar} />}
    </div>
  )
}
