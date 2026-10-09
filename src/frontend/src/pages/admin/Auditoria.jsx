import { useCallback, useEffect, useState } from 'react'
import { listarCambios, listarCambiosPedidos, listarPersonalCompleto } from '../../api/auditoria'
import { listarTodosLosProductos } from '../../api/productos'
import { EncabezadoPagina, EstadoCarga, Paginacion, Selector } from '../../components/ui'
import { ESTADOS_PEDIDO, claseInput } from '../../utils/panel'
import { formatoFechaHora } from '../../utils/formato'

// Auditoría (solo gerente): quién cambió qué producto o stock, con el valor antes y
// después, y quién movió cada pedido de estado. Se filtra por usuario, producto y fecha.
const TAMANO = 25
const ACCIONES = {
  crear: { nombre: 'Creó', clase: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
  editar: { nombre: 'Editó', clase: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
  borrar: { nombre: 'Borró', clase: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' },
  descargar_reporte: { nombre: 'Descargó informe', clase: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' },
}

const texto = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

// Muestra solo los campos que cambiaron: campo · antes → después.
function Diferencias({ antes, despues }) {
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])].filter(
    (c) => texto(antes?.[c]) !== texto(despues?.[c]),
  )
  if (campos.length === 0) return <span className="text-slate-400">—</span>
  return (
    <ul className="space-y-0.5">
      {campos.map((c) => (
        <li key={c} className="text-xs">
          <span className="font-medium text-slate-700">{c}</span>:{' '}
          {antes && <span className="text-red-700 dark:text-red-300 line-through decoration-red-300">{texto(antes[c])}</span>}
          {antes && despues && ' → '}
          {despues && <span className="text-emerald-700 dark:text-emerald-300">{texto(despues[c])}</span>}
        </li>
      ))}
    </ul>
  )
}

export default function Auditoria() {
  const [vista, setVista] = useState('productos')
  const [personal, setPersonal] = useState([])
  const [productos, setProductos] = useState([])
  const [filtros, setFiltros] = useState({ usuarioId: '', productoId: '', desde: '', hasta: '' })
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listarPersonalCompleto().then(setPersonal).catch(() => {})
    listarTodosLosProductos().then(setProductos).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    // "hasta" es inclusive: se pide hasta el final de ese día.
    const consulta = {
      usuarioId: filtros.usuarioId,
      desde: filtros.desde && `${filtros.desde}T00:00:00`,
      hasta: filtros.hasta && `${filtros.hasta}T23:59:59`,
      pagina,
      tamano: TAMANO,
    }
    try {
      setResultado(
        vista === 'productos'
          ? await listarCambios({ ...consulta, productoId: filtros.productoId })
          : await listarCambiosPedidos(consulta),
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [vista, filtros, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  function filtrar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Auditoría" detalle="Todo cambio queda registrado: quién, qué, cuándo y cómo estaba antes." />

      <Selector
        etiqueta="Qué auditar"
        opciones={[
          ['productos', 'Productos, stock e informes'],
          ['pedidos', 'Estados de pedidos'],
        ]}
        valor={vista}
        alCambiar={(v) => {
          setVista(v)
          setPagina(1)
          setResultado(null)
        }}
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-superficie p-3 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Filtrar por usuario" value={filtros.usuarioId} onChange={(e) => filtrar('usuarioId', e.target.value)} className={claseInput()}>
          <option value="">Todos los usuarios</option>
          {personal.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({u.rol})
            </option>
          ))}
        </select>
        {vista === 'productos' && (
          <select aria-label="Filtrar por producto" value={filtros.productoId} onChange={(e) => filtrar('productoId', e.target.value)} className={claseInput()}>
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Desde
          <input type="date" value={filtros.desde} onChange={(e) => filtrar('desde', e.target.value)} className={claseInput()} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Hasta
          <input type="date" value={filtros.hasta} onChange={(e) => filtrar('hasta', e.target.value)} className={claseInput()} />
        </label>
      </div>

      <EstadoCarga cargando={cargando && !resultado} error={error} alReintentar={cargar} vacio={resultado?.items.length === 0} textoVacio="No hay cambios con esos filtros.">
        <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-superficie ${cargando ? 'opacity-60' : ''}`}>
          {vista === 'productos' ? (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Acción</th>
                  <th className="px-4 py-3 font-semibold">Sobre</th>
                  <th className="px-4 py-3 font-semibold">Cambios (antes → después)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {resultado?.items.map((a) => {
                  const accion = ACCIONES[a.accion] ?? { nombre: a.accion, clase: 'bg-slate-100 text-slate-700' }
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatoFechaHora(a.creadoEn)}</td>
                      <td className="px-4 py-3">{a.usuario ?? 'Sistema'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${accion.clase}`}>{accion.nombre}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize text-slate-500">{a.entidad}</span>
                        <span className="block font-medium text-slate-800">{a.entidadNombre ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Diferencias antes={a.datosAntes} despues={a.datosDespues} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Pedido</th>
                  <th className="px-4 py-3 font-semibold">Cambio de estado</th>
                  <th className="px-4 py-3 font-semibold">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultado?.items.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatoFechaHora(c.creadoEn)}</td>
                    <td className="px-4 py-3 font-medium">#{c.numeroPedido}</td>
                    <td className="px-4 py-3">
                      {c.estadoAnterior ? ESTADOS_PEDIDO[c.estadoAnterior]?.nombre ?? c.estadoAnterior : 'Nuevo'} →{' '}
                      <span className="font-semibold">{ESTADOS_PEDIDO[c.estadoNuevo]?.nombre ?? c.estadoNuevo}</span>
                    </td>
                    <td className="px-4 py-3">{c.usuario ?? 'Sistema'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={TAMANO} alCambiar={setPagina} />
      </EstadoCarga>
    </div>
  )
}
