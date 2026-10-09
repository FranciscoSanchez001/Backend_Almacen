import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarPedidos } from '../../api/pedidos'
import { listarInventario } from '../../api/inventario'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../../api/notificaciones'
import { useAuth } from '../../context/AuthContext'
import ContadorExpiracion from '../../components/ContadorExpiracion'
import { EncabezadoPagina, EstadoCarga } from '../../components/ui'
import { claseBoton } from '../../utils/panel'
import { formatoFechaHora, formatoUsd } from '../../utils/formato'

// Inicio del panel de ventas: lo que hay que atender ya. Pedidos pendientes (los
// más cerca de vencer primero), alertas de stock y avisos sin leer.
// No es el dashboard de KPIs: ese es solo del gerente.
const TIPOS_AVISO = {
  stock_agotado: { icono: '⛔', texto: (n) => `Se agotó ${n.producto ?? 'un producto'}` },
  pedido_nuevo: { icono: '🛒', texto: () => 'Llegó un pedido nuevo' },
  pedido_por_expirar: { icono: '⏱', texto: () => 'Un pedido está por expirar' },
}

function Tarjeta({ titulo, valor, detalle, a, alerta }) {
  return (
    <Link to={a} className="rounded-xl border border-slate-200 bg-superficie p-4 transition hover:border-marca-200 dark:hover:border-marca-500 hover:shadow-sm">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className={`mt-1 text-3xl font-bold ${alerta ? 'text-red-700 dark:text-red-300' : 'text-slate-900'}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </Link>
  )
}

export default function Resumen() {
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setError('')
    try {
      const [pendientes, inventario, avisos] = await Promise.all([
        listarPedidos({ estado: 'pendiente', tamano: 5 }),
        listarInventario(),
        listarNotificaciones(),
      ])
      setDatos({ pendientes, inventario, avisos })
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function leer(id) {
    await marcarLeida(id).catch(() => {})
    cargar()
  }

  async function leerTodas() {
    await marcarTodasLeidas().catch(() => {})
    cargar()
  }

  const agotados = datos?.inventario.filter((p) => p.stockDisponible === 0) ?? []
  const bajos = datos?.inventario.filter((p) => p.stockDisponible > 0 && p.stockDisponible < p.stockMinimo) ?? []
  const primerNombre = usuario.nombre?.split(' ')[0]

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo={`Hola, ${primerNombre} 👋`} detalle="Esto es lo que necesita atención ahora.">
        <button type="button" onClick={cargar} className={claseBoton.secundario}>
          Actualizar
        </button>
      </EncabezadoPagina>

      <EstadoCarga cargando={!datos && !error} error={error} alReintentar={cargar}>
        {datos && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tarjeta titulo="Pedidos por revisar" valor={datos.pendientes.total} detalle="Vencen a las 5 h de creados" a="/panel/pedidos" alerta={datos.pendientes.total > 0} />
              <Tarjeta titulo="Productos agotados" valor={agotados.length} detalle="No se ven en la tienda" a="/panel/inventario" alerta={agotados.length > 0} />
              <Tarjeta titulo="Bajo el stock mínimo" valor={bajos.length} detalle="Conviene reponer pronto" a="/panel/inventario" />
              <Tarjeta titulo="Avisos sin leer" valor={datos.avisos.total} detalle="Stock y pedidos" a="/panel#avisos" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-superficie p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Los más urgentes</h3>
                  <Link to="/panel/pedidos" className="text-sm font-medium text-marca-700 dark:text-marca-200 hover:underline">
                    Ir a la bandeja →
                  </Link>
                </div>
                {datos.pendientes.items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">¡Todo al día! No hay pedidos pendientes.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {datos.pendientes.items.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span>
                          <span className="font-medium">#{p.numero}</span> · {p.cliente?.nombre}
                          <span className="block text-xs text-slate-500">
                            {formatoUsd(p.totalUsd)} · {p.zona?.nombre}
                          </span>
                        </span>
                        <ContadorExpiracion expiraEn={p.expiraEn} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section id="avisos" className="scroll-mt-20 rounded-xl border border-slate-200 bg-superficie p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Avisos</h3>
                  {datos.avisos.total > 0 && (
                    <button type="button" onClick={leerTodas} className="text-sm font-medium text-marca-700 dark:text-marca-200 hover:underline">
                      Marcar todos como leídos
                    </button>
                  )}
                </div>
                {datos.avisos.items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No hay avisos sin leer.</p>
                ) : (
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {datos.avisos.items.map((n) => {
                      const tipo = TIPOS_AVISO[n.tipo] ?? { icono: '🔔', texto: () => n.tipo }
                      return (
                        <li key={n.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                          <span>
                            <span aria-hidden>{tipo.icono}</span> {tipo.texto(n)}
                            <span className="block text-xs text-slate-500">{formatoFechaHora(n.creadoEn)}</span>
                          </span>
                          <button type="button" onClick={() => leer(n.id)} className={claseBoton.pequeno}>
                            Leído
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </EstadoCarga>
    </div>
  )
}
