import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listarMisPedidos } from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import BotonGoogle from '../../components/BotonGoogle'
import ContadorExpiracion from '../../components/ContadorExpiracion'
import DetallePedido from '../../components/DetallePedido'
import Modal from '../../components/Modal'
import { EstadoCarga, EtiquetaEstado, Paginacion } from '../../components/ui'
import { formatoBs, formatoFechaHora, formatoUsd } from '../../utils/formato'

// Pedidos del cliente (GET /pedidos/mios), los más recientes primero, con su estado y el detalle.
const TAMANO = 10

// Lo que significa cada estado para el cliente.
const QUE_PASA = {
  pendiente: 'Estamos verificando tu pago.',
  asignado: 'Pago aprobado. Ya tiene repartidor asignado.',
  en_camino: '¡Tu pedido va en camino!',
  entregado: 'Pedido entregado.',
  rechazado: 'El pedido fue rechazado.',
  expirado: 'No se revisó a tiempo y se canceló.',
}

export default function MisPedidos() {
  const { usuario } = useAuth()
  const { state } = useLocation()
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [abierto, setAbierto] = useState(null)
  const esCliente = usuario?.rol === 'cliente'

  useEffect(() => {
    if (!esCliente) return
    let vigente = true
    setError(null)
    listarMisPedidos({ pagina, tamano: TAMANO })
      .then((r) => vigente && setResultado(r))
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [esCliente, pagina, intento])

  if (!esCliente) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-superficie p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Mis pedidos</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Ingresa con tu cuenta de Google para ver tus pedidos.</p>
        <BotonGoogle />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Mis pedidos</h1>

      {state?.nuevo && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-semibold">¡Recibimos tu pedido #{state.nuevo}!</p>
          <p className="text-sm">Vamos a verificar tu pago y te avisaremos por WhatsApp cuando lo aprobemos.</p>
        </div>
      )}

      <EstadoCarga
        cargando={!resultado && !error}
        error={error}
        alReintentar={() => setIntento((n) => n + 1)}
        vacio={resultado?.items.length === 0}
        textoVacio="Todavía no has hecho pedidos."
      >
        <ul className="space-y-3">
          {resultado?.items.map((p) => (
            <li key={p.id} className="rounded-2xl border border-slate-200 bg-superficie p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    Pedido #{p.numero} <EtiquetaEstado estado={p.estado} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatoFechaHora(p.creadoEn)} · {p.items.reduce((s, i) => s + i.cantidad, 0)} productos · {p.zona.nombre}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{QUE_PASA[p.estado]}</p>
                  {p.estado === 'pendiente' && (
                    <div className="mt-1">
                      <ContadorExpiracion expiraEn={p.expiraEn} />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{formatoUsd(p.totalUsd)}</p>
                  <p className="text-xs text-slate-500">{formatoBs(p.totalBs)}</p>
                  <button
                    type="button"
                    onClick={() => setAbierto(p)}
                    className="mt-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {resultado && <Paginacion pagina={pagina} total={resultado.total} tamano={TAMANO} alCambiar={setPagina} />}
      </EstadoCarga>

      <p className="text-center text-sm">
        <Link to="/" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
          Seguir comprando
        </Link>
      </p>

      <Modal abierto={!!abierto} titulo={abierto ? `Pedido #${abierto.numero}` : ''} alCerrar={() => setAbierto(null)} ancho="sm:max-w-2xl">
        {abierto && <DetallePedido pedido={abierto} />}
      </Modal>
    </div>
  )
}
