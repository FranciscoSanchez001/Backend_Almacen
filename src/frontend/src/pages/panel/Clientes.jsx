import { useCallback, useEffect, useState } from 'react'
import { buscarClientes, pedidosDeCliente } from '../../api/clientes'
import Modal from '../../components/Modal'
import DetallePedido from '../../components/DetallePedido'
import { EncabezadoPagina, EstadoCarga, EtiquetaEstado, Paginacion } from '../../components/ui'
import { claseInput } from '../../utils/panel'
import { formatoBs, formatoFechaHora, formatoUsd } from '../../utils/formato'

// Historial de compras de un cliente: se busca por nombre, correo o teléfono,
// se elige el cliente y se ven todos sus pedidos (con el detalle de cada uno).
const TAMANO = 20

function HistorialCliente({ cliente, alAbrirPedido }) {
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    setResultado(null)
    pedidosDeCliente(cliente.id, { pagina, tamano: 10 })
      .then((r) => vigente && setResultado(r))
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [cliente.id, pagina])

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-superficie p-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{cliente.nombre}</h3>
        <p className="text-sm text-slate-500">
          {cliente.email}
          {cliente.telefono && ` · ${cliente.telefono}`} · {cliente.pedidos} pedidos
        </p>
      </div>
      <EstadoCarga cargando={!resultado && !error} error={error} vacio={resultado?.items.length === 0} textoVacio="Este cliente todavía no tiene pedidos.">
        <ul className="divide-y divide-slate-100">
          {resultado?.items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => alAbrirPedido(p)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">Pedido #{p.numero}</span>
                  <span className="block text-xs text-slate-500">
                    {formatoFechaHora(p.creadoEn)} · {p.items.length} productos
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <EtiquetaEstado estado={p.estado} />
                  <span className="text-right">
                    <span className="block font-semibold">{formatoUsd(p.totalUsd)}</span>
                    <span className="block text-xs text-slate-500">{formatoBs(p.totalBs)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={10} alCambiar={setPagina} />
      </EstadoCarga>
    </section>
  )
}

export default function Clientes() {
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState(null)
  const [pedido, setPedido] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setResultado(await buscarClientes({ buscar, pagina, tamano: TAMANO }))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [buscar, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscar(q.trim())
      setPagina(1)
    }, 500)
    return () => clearTimeout(t)
  }, [q])

  const cerrarPedido = useCallback(() => setPedido(null), [])

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Clientes" detalle="Busca un cliente por nombre, correo o teléfono para ver su historial de compras." />

      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, correo o teléfono" aria-label="Buscar clientes" className={`${claseInput()} max-w-md`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <EstadoCarga cargando={cargando} error={error} alReintentar={cargar} vacio={resultado?.items.length === 0} textoVacio="Ningún cliente coincide.">
          <div>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-superficie">
              {resultado?.items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(c)}
                    aria-pressed={elegido?.id === c.id}
                    className={`w-full px-4 py-3 text-left ${elegido?.id === c.id ? 'bg-marca-50 dark:bg-marca-700/40' : 'hover:bg-slate-50'}`}
                  >
                    <span className="block font-medium text-slate-900">{c.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.email} · {c.pedidos} pedidos
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={TAMANO} alCambiar={setPagina} />
          </div>
        </EstadoCarga>

        {elegido ? (
          <HistorialCliente key={elegido.id} cliente={elegido} alAbrirPedido={setPedido} />
        ) : (
          <div className="hidden rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 lg:block">
            Elige un cliente para ver sus compras.
          </div>
        )}
      </div>

      <Modal abierto={pedido !== null} titulo={pedido ? `Pedido #${pedido.numero}` : ''} alCerrar={cerrarPedido} ancho="sm:max-w-3xl">
        {pedido && <DetallePedido pedido={pedido} />}
      </Modal>
    </div>
  )
}
