import { useCallback, useEffect, useRef, useState } from 'react'
import { marcarEnCamino, marcarEntregado, obtenerPedido } from '../../api/pedidos'
import Icono from '../../components/Icono'
import { EtiquetaEstado } from '../../components/ui'
import { ESTADOS_PEDIDO, claseBoton } from '../../utils/panel'
import { formatoFechaHora, formatoUsd } from '../../utils/formato'
import { enlacesMapa } from '../../utils/entregas'

export default function DetalleEntrega({ pedidoId, alCerrar, alActualizar }) {
  const dialogo = useRef(null)
  const vivo = useRef(false)
  const bloqueado = useRef(false)
  const solicitud = useRef(0)
  const [pedido, setPedido] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState(null)
  const [necesitaActualizar, setNecesitaActualizar] = useState(false)

  const cargar = useCallback(async () => {
    const numeroSolicitud = ++solicitud.current
    setCargando(true)
    setError('')
    setPedido(null)
    setConfirmacion(null)
    setNecesitaActualizar(false)
    try {
      const actual = await obtenerPedido(pedidoId)
      if (vivo.current && solicitud.current === numeroSolicitud) setPedido(actual)
    } catch (err) {
      if (vivo.current && solicitud.current === numeroSolicitud) setError(err.message)
    } finally {
      if (vivo.current && solicitud.current === numeroSolicitud) setCargando(false)
    }
  }, [pedidoId])

  useEffect(() => {
    vivo.current = true
    const elemento = dialogo.current
    const focoPrevio = document.activeElement
    const overflowPrevio = document.body.style.overflow
    elemento.showModal()
    document.body.style.overflow = 'hidden'
    cargar()
    return () => {
      vivo.current = false
      elemento.close()
      document.body.style.overflow = overflowPrevio
      focoPrevio?.focus()
    }
  }, [cargar])

  async function confirmar() {
    if (bloqueado.current || !confirmacion || !pedido) return
    bloqueado.current = true
    setEnviando(true)
    setError('')
    try {
      const actualizado = await (confirmacion === 'en_camino' ? marcarEnCamino(pedido.id) : marcarEntregado(pedido.id))
      if (!vivo.current) return
      setPedido(actualizado)
      setConfirmacion(null)
      alActualizar(actualizado, `Pedido #${actualizado.numero} ${actualizado.estado === 'entregado' ? 'entregado' : 'en camino'}.`)
    } catch (err) {
      if (vivo.current) {
        setError(err.message)
        if ([0, 404, 409].includes(err.estado)) {
          setNecesitaActualizar(true)
          setConfirmacion(null)
        }
      }
    } finally {
      bloqueado.current = false
      if (vivo.current) setEnviando(false)
    }
  }

  const mapas = pedido && enlacesMapa(pedido)
  return (
    <dialog ref={dialogo} aria-labelledby="titulo-detalle-entrega"
      onCancel={e => { e.preventDefault(); if (!bloqueado.current) alCerrar() }}
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-superficie p-0 text-slate-900 shadow-xl backdrop:bg-black/50">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-superficie px-5 py-4">
        <h2 id="titulo-detalle-entrega" className="text-lg font-bold">{pedido ? `Entrega del pedido #${pedido.numero}` : 'Detalle de entrega'}</h2>
        <button type="button" aria-label="Cerrar detalle de entrega" disabled={enviando} onClick={alCerrar} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><Icono nombre="cerrar" className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        {cargando && <p role="status">Consultando la entrega…</p>}
        {error && <div className="space-y-3"><p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p><button type="button" onClick={cargar} disabled={enviando} className={claseBoton.secundario}>Actualizar entrega</button></div>}
        {pedido && <>
          <div className="flex flex-wrap items-center gap-3"><EtiquetaEstado estado={pedido.estado} /><span className="text-sm text-slate-500">{formatoUsd(pedido.totalUsd)}</span></div>
          <section className="rounded-xl bg-slate-50 p-4 text-sm">
            <h3 className="font-bold">Datos de entrega</h3>
            <p className="mt-2 font-semibold">{pedido.cliente.nombre}</p>
            <p className="mt-1">{pedido.zona.nombre} · {pedido.direccionTexto}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${pedido.telefonoContacto}`} className={claseBoton.secundario}>Llamar al cliente</a>
              <a href={`https://wa.me/${pedido.telefonoContacto.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={claseBoton.secundario}>WhatsApp <Icono nombre="enlace-externo" /></a>
              <a href={mapas.google} target="_blank" rel="noreferrer" className={claseBoton.secundario}>Google Maps <Icono nombre="enlace-externo" /></a>
              <a href={mapas.waze} target="_blank" rel="noreferrer" className={claseBoton.secundario}>Waze <Icono nombre="enlace-externo" /></a>
            </div>
          </section>
          <section><h3 className="font-bold">Productos a entregar</h3>
            <ul className="mt-2 divide-y divide-slate-200">{pedido.items.map(item => <li key={item.productoId} className="flex justify-between gap-3 py-2 text-sm"><span>{item.producto}</span><span className="shrink-0 font-semibold">{item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'}</span></li>)}</ul>
          </section>
          {pedido.historial?.length > 0 && <section><h3 className="font-bold">Historial de estados</h3><ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4 text-xs text-slate-500">{pedido.historial.map((entrada, indice) => <li key={indice}>{ESTADOS_PEDIDO[entrada.estadoNuevo]?.nombre ?? entrada.estadoNuevo} · {formatoFechaHora(entrada.creadoEn)}</li>)}</ol></section>}
          <div className="border-t border-slate-200 pt-4">
            {confirmacion ? <>
              <p className="mb-3 text-sm">{confirmacion === 'entregado' ? 'Confirma que entregaste el pedido al cliente.' : 'Confirma que recogiste el pedido y vas en camino al cliente.'}</p>
              <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={enviando} onClick={() => setConfirmacion(null)} className={claseBoton.secundario}>Cancelar</button><button type="button" disabled={enviando} onClick={confirmar} className={claseBoton.primario}>{enviando ? 'Guardando…' : confirmacion === 'entregado' ? 'Confirmar entrega' : 'Confirmar salida'}</button></div>
            </> : pedido.estado === 'asignado' || pedido.estado === 'en_camino' ? <button type="button" disabled={necesitaActualizar} onClick={() => setConfirmacion(pedido.estado === 'asignado' ? 'en_camino' : 'entregado')} className={`${claseBoton.primario} w-full`}>{pedido.estado === 'asignado' ? 'Iniciar entrega' : 'Marcar entregado'}</button> : <p className="text-sm text-slate-500">Esta entrega ya está finalizada.</p>}
            {necesitaActualizar && <p className="mt-3 text-xs text-slate-500">Actualiza la entrega para comprobar su estado antes de continuar.</p>}
          </div>
        </>}
      </div>
    </dialog>
  )
}
