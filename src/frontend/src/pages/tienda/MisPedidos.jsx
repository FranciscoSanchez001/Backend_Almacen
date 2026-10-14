import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarMisPedidos } from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import AccesoCliente from '../../components/AccesoCliente'
import { EtiquetaEstado, Paginacion } from '../../components/ui'
import { formatoFechaHora, formatoUsd } from '../../utils/formato'

export default function MisPedidos() {
  const { usuario } = useAuth()
  const [pedidos, setPedidos] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (usuario?.rol !== 'cliente') return
    let activo = true
    setPedidos(null)
    setError('')
    listarMisPedidos({ pagina }).then(datos => { if (activo) { setPedidos(datos.items); setTotal(datos.total) } })
      .catch(err => { if (activo) setError(err.message) })
    return () => { activo = false }
  }, [usuario?.id, usuario?.rol, intento, pagina])
  return <AccesoCliente><div className="mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Mis pedidos</h1><button type="button" onClick={() => setIntento(i => i + 1)} className="text-sm text-emerald-700 dark:text-emerald-300">Actualizar</button></div>
    {!pedidos && !error && <p role="status">Consultando tus pedidos…</p>}
    {error && <p role="alert">{error}</p>}
    {pedidos?.length === 0 && <p>Aún no tienes pedidos.</p>}
    {pedidos?.map(pedido => <article key={pedido.id} className="rounded-2xl border border-slate-200 bg-superficie p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">Pedido #{pedido.numero}</h2><EtiquetaEstado estado={pedido.estado} /></div>
      <p className="mt-2 text-sm text-slate-500">{formatoFechaHora(pedido.creadoEn)} · {pedido.zona.nombre}</p>
      <ul className="mt-3 text-sm">{pedido.items.map(item => <li key={item.productoId}>{item.cantidad} × {item.producto}</li>)}</ul>
      <p className="mt-3 font-bold">{formatoUsd(pedido.totalUsd)}</p>
      {pedido.motivoRechazo && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{pedido.motivoRechazo}</p>}
    </article>)}
    {pedidos && <Paginacion pagina={pagina} total={total} tamano={20} alCambiar={setPagina} />}
    <Link to="/" className="inline-block text-sm text-emerald-700 dark:text-emerald-300">Volver a la tienda</Link>
  </div></AccesoCliente>
}
