import { urlArchivo } from '../api/cliente'
import { formatoBs, formatoFechaHora, formatoUsd } from '../utils/formato'
import { EtiquetaEstado } from './ui'
import { ESTADOS_PEDIDO, METODOS_PAGO } from '../utils/panel'
import Icono from './Icono'

// Todo lo que el personal necesita ver de un pedido: productos, totales con la
// tasa congelada, pago (captura y referencia), entrega (zona, dirección, mapa,
// teléfono) e historial de estados. Las acciones las pone quien lo usa (children).
export default function DetallePedido({ pedido, children }) {
  const captura = urlArchivo(pedido.capturaUrl)
  const hayMapa = pedido.latitud != null && pedido.longitud != null
  const moneda = pedido.monedaPago === 'USDT' ? 'USDT' : 'Bs'

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <EtiquetaEstado estado={pedido.estado} />
        <span className="text-slate-500">Creado el {formatoFechaHora(pedido.creadoEn)}</span>
      </div>

      {/* Productos */}
      <section>
        <h3 className="mb-2 font-semibold text-slate-800">Productos</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[420px] text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Producto</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-right font-semibold">Precio</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pedido.items.map((it) => (
                <tr key={it.productoId}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">{it.producto}</span>
                    <span className="block text-xs text-slate-500">{it.categoria}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{it.cantidad}</td>
                  <td className="px-3 py-2 text-right">{formatoUsd(it.precioUsd)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatoUsd(it.subtotalUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-right">
          <p className="text-lg font-bold text-slate-900">{formatoUsd(pedido.totalUsd)}</p>
          <p className="text-xs text-slate-500">
            {formatoBs(pedido.totalBs)} · tasa congelada {pedido.tasaCambio}
          </p>
        </div>
      </section>

      {/* Pago */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <h3 className="mb-1 font-semibold text-slate-800">Pago</h3>
          <p>
            {METODOS_PAGO[pedido.metodoPago] ?? pedido.metodoPago} · se paga en {moneda}
          </p>
          <p className="mt-1">
            Referencia: <span className="font-mono font-semibold">{pedido.referenciaPago}</span>
          </p>
          {captura ? (
            <a href={captura} target="_blank" rel="noreferrer" className="mt-2 block">
              <img src={captura} alt="Captura del comprobante de pago" className="max-h-56 rounded-lg border border-slate-200 object-contain" />
            </a>
          ) : (
            <p className="mt-2 text-xs text-slate-500">El pedido no tiene captura adjunta.</p>
          )}
        </div>

        {/* Entrega */}
        <div className="rounded-lg bg-slate-50 p-3">
          <h3 className="mb-1 font-semibold text-slate-800">Entrega</h3>
          <p>
            <span className="font-medium">{pedido.zona?.nombre}</span> · {pedido.direccionTexto}
          </p>
          <p className="mt-1">
            Cliente: {pedido.cliente?.nombre} ·{' '}
            <a href={`tel:${pedido.telefonoContacto}`} className="font-medium text-marca-700 dark:text-marca-200 hover:underline">
              {pedido.telefonoContacto}
            </a>
          </p>
          {pedido.repartidor && <p className="mt-1">Repartidor: {pedido.repartidor.nombre}</p>}
          {pedido.motivoRechazo && <p className="mt-1 text-red-700 dark:text-red-300">Motivo del rechazo: {pedido.motivoRechazo}</p>}
          {hayMapa && (
            <>
              <iframe
                title={`Mapa de la entrega del pedido ${pedido.numero}`}
                className="mt-2 h-40 w-full rounded-lg border border-slate-200"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${pedido.longitud - 0.004},${pedido.latitud - 0.003},${pedido.longitud + 0.004},${pedido.latitud + 0.003}&layer=mapnik&marker=${pedido.latitud},${pedido.longitud}`}
              />
              <a
                href={`https://www.google.com/maps?q=${pedido.latitud},${pedido.longitud}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-medium text-marca-700 dark:text-marca-200 hover:underline"
              >
                Abrir en Google Maps <Icono nombre="externo" className="h-3 w-3 align-[-1px]" />
              </a>
            </>
          )}
        </div>
      </section>

      {/* Historial */}
      {pedido.historial?.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-slate-800">Historial</h3>
          <ol className="space-y-1 border-l-2 border-slate-200 pl-4">
            {pedido.historial.map((h, i) => (
              <li key={i} className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{ESTADOS_PEDIDO[h.estadoNuevo]?.nombre ?? h.estadoNuevo}</span>{' '}
                · {formatoFechaHora(h.creadoEn)} · {h.usuario?.nombre ?? 'Sistema'}
              </li>
            ))}
          </ol>
        </section>
      )}

      {children}
    </div>
  )
}
