import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarInventario, listarMovimientos, reponer } from '../../api/inventario'
import Modal from '../../components/Modal'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga, Paginacion, Selector } from '../../components/ui'
import { claseBoton, claseInput } from '../../utils/panel'
import { formatoFechaHora } from '../../utils/formato'
import { alertaStock } from '../../utils/stock'
import Icono from '../../components/Icono'

// Inventario: stock disponible y reservado de cada producto, con alertas según los
// umbrales del producto (stock mínimo y máximo). "Reponer" suma lo que llegó y el
// producto vuelve a aparecer en la tienda. Cada producto tiene su historial de movimientos.
const FILTROS = [
  ['todos', 'Todos'],
  ['agotados', 'Agotados'],
  ['bajos', 'Bajo mínimo'],
  ['sobre', 'Sobre máximo'],
]

const TIPOS_MOVIMIENTO = {
  reserva: 'Reserva',
  venta: 'Venta',
  liberacion: 'Liberación',
  reposicion: 'Reposición',
  ajuste: 'Ajuste',
}

function Reponer({ producto, alListo }) {
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const sugerida = Math.max(0, producto.stockMaximo - producto.stockDisponible)

  async function alEnviar(e) {
    e.preventDefault()
    const n = Number(cantidad)
    if (!Number.isInteger(n) || n <= 0) return setError('Escribe una cantidad entera mayor que 0.')
    setEnviando(true)
    try {
      await reponer(producto.productoId, n)
      alListo(`Se sumaron ${n} unidades a ${producto.nombre}.`)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <p className="text-sm text-slate-700">
        Hay <strong>{producto.stockDisponible}</strong> disponibles (mín. {producto.stockMinimo}, máx. {producto.stockMaximo}).
      </p>
      <Campo id="cantidad" etiqueta="Cantidad que llegó" error={error} ayuda={sugerida ? `Para llegar al máximo faltan ${sugerida}.` : undefined}>
        <input
          id="cantidad"
          type="number"
          min="1"
          step="1"
          autoFocus
          value={cantidad}
          onChange={(e) => {
            setCantidad(e.target.value)
            setError('')
          }}
          className={claseInput(error)}
        />
      </Campo>
      <div className="flex justify-end">
        <button type="submit" disabled={enviando} className={claseBoton.primario}>
          {enviando ? 'Guardando…' : 'Reponer'}
        </button>
      </div>
    </form>
  )
}

function Movimientos({ producto }) {
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    listarMovimientos(producto.productoId, { pagina, tamano: 15 })
      .then((r) => vigente && setResultado(r))
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [producto.productoId, pagina])

  return (
    <EstadoCarga cargando={!resultado && !error} error={error} vacio={resultado?.items.length === 0} textoVacio="Sin movimientos todavía.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 font-semibold">Fecha</th>
              <th className="py-2 font-semibold">Tipo</th>
              <th className="py-2 text-right font-semibold">Cantidad</th>
              <th className="py-2 text-right font-semibold">Disponible</th>
              <th className="py-2 pl-4 font-semibold">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resultado?.items.map((m) => (
              <tr key={m.id}>
                <td className="py-2 text-slate-600">{formatoFechaHora(m.creadoEn)}</td>
                <td className="py-2">{TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                <td className={`py-2 text-right font-medium ${m.cantidad < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                </td>
                <td className="py-2 text-right text-slate-600">
                  {m.disponibleAntes} → {m.disponibleDespues}
                </td>
                <td className="py-2 pl-4 text-slate-600">{m.usuario ?? 'Sistema'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={15} alCambiar={setPagina} />
    </EstadoCarga>
  )
}

export default function Inventario() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [reponiendo, setReponiendo] = useState(null)
  const [viendo, setViendo] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setProductos(await listarInventario())
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const conteo = useMemo(
    () => ({
      agotados: productos.filter((p) => p.stockDisponible === 0).length,
      bajos: productos.filter((p) => p.stockDisponible > 0 && p.stockDisponible < p.stockMinimo).length,
      sobre: productos.filter((p) => p.stockDisponible > p.stockMaximo).length,
    }),
    [productos],
  )

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return productos.filter((p) => {
      const estado = alertaStock(p).texto
      const pasaFiltro =
        filtro === 'todos' ||
        (filtro === 'agotados' && estado === 'Agotado') ||
        (filtro === 'bajos' && estado === 'Bajo mínimo') ||
        (filtro === 'sobre' && estado === 'Sobre máximo')
      return pasaFiltro && (!texto || p.nombre.toLowerCase().includes(texto) || p.codigoSku.toLowerCase().includes(texto))
    })
  }, [productos, q, filtro])

  const cerrarReponer = useCallback(() => setReponiendo(null), [])
  const cerrarMovimientos = useCallback(() => setViendo(null), [])

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Inventario" detalle="Stock disponible y reservado, con alertas según el mínimo y el máximo de cada producto." />

      <Aviso aviso={aviso} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-superficie p-4">
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Icono nombre="agotado" tono /> Agotados</p>
          <p className="text-2xl font-bold text-slate-900">{conteo.agotados}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-superficie p-4">
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Icono nombre="alerta" tono /> Bajo el mínimo</p>
          <p className="text-2xl font-bold text-slate-900">{conteo.bajos}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-superficie p-4">
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Icono nombre="caja" tono /> Sobre el máximo</p>
          <p className="text-2xl font-bold text-slate-900">{conteo.sobre}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o SKU" aria-label="Buscar en el inventario" className={`${claseInput()} lg:max-w-xs`} />
        <Selector etiqueta="Filtrar por alerta" opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
      </div>

      <EstadoCarga cargando={cargando} error={error} alReintentar={cargar} vacio={visibles.length === 0} textoVacio="Ningún producto coincide.">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-superficie">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 text-right font-semibold">Disponible</th>
                <th className="px-4 py-3 text-right font-semibold">Reservado</th>
                <th className="px-4 py-3 text-right font-semibold">Mín. / Máx.</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((p) => {
                const alerta = alertaStock(p)
                return (
                  <tr key={p.productoId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.nombre}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{p.codigoSku}</span> · {p.categoria}
                        {p.ubicacion && ` · ${p.ubicacion}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold">{p.stockDisponible}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{p.stockReservado}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {p.stockMinimo} / {p.stockMaximo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${alerta.clase}`}>
                        <Icono nombre={alerta.icono} className="h-3.5 w-3.5" /> {alerta.texto}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setViendo(p)} className={claseBoton.pequeno}>
                          Movimientos
                        </button>
                        <button
                          type="button"
                          onClick={() => setReponiendo(p)}
                          className="rounded-lg bg-marca-700 dark:bg-marca-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-800 dark:hover:bg-marca-500"
                        >
                          Reponer
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </EstadoCarga>

      <Modal abierto={reponiendo !== null} titulo={reponiendo ? `Reponer · ${reponiendo.nombre}` : ''} alCerrar={cerrarReponer} ancho="sm:max-w-md">
        {reponiendo && (
          <Reponer
            key={reponiendo.productoId}
            producto={reponiendo}
            alListo={(texto) => {
              setReponiendo(null)
              setAviso({ tipo: 'ok', texto })
              cargar()
            }}
          />
        )}
      </Modal>

      <Modal abierto={viendo !== null} titulo={viendo ? `Movimientos · ${viendo.nombre}` : ''} alCerrar={cerrarMovimientos} ancho="sm:max-w-2xl">
        {viendo && <Movimientos key={viendo.productoId} producto={viendo} />}
      </Modal>
    </div>
  )
}
