import Icono from '../Icono'
import { formatoNumero, formatoPct } from '../../utils/formato'
import { anchoBarra, nivelOcupacion } from '../../utils/ocupacion'

// KPI de logística: porcentaje de la capacidad del almacén en uso, global, por categoría y por
// producto. Ocupación = (disponible + reservado) ÷ stock máximo; el cálculo y el nivel vienen
// de la API (kpis.inventario).

function ChipNivel({ nivel }) {
  const n = nivelOcupacion(nivel)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${n.clase}`}>
      <Icono nombre={n.icono} className="h-3.5 w-3.5" /> {n.texto}
    </span>
  )
}

function Barra({ etiqueta, porcentaje, nivel, detalle }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium text-slate-800">{etiqueta}</span>
        <span className="shrink-0 font-semibold text-slate-900">{porcentaje == null ? '—' : formatoPct(porcentaje)}</span>
      </div>
      <div
        className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`Ocupación de ${etiqueta}`}
        aria-valuenow={porcentaje ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${nivelOcupacion(nivel).barra}`} style={{ width: anchoBarra(porcentaje) }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{detalle}</span>
        <ChipNivel nivel={nivel} />
      </div>
    </li>
  )
}

export default function OcupacionAlmacen({ inventario }) {
  const masOcupados = [...inventario.productos]
    .filter((p) => p.ocupacion != null)
    .sort((a, b) => b.ocupacion - a.ocupacion)
    .slice(0, 5)

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-superficie p-4 xl:col-span-2">
      <h3 className="font-semibold text-slate-900">Ocupación del almacén</h3>
      <p className="text-xs text-slate-500">
        Unidades en el almacén (disponible + reservado) ÷ capacidad (stock máximo). Baja &lt; 20 %, óptima 20–85 %, alta 85–100 %,
        saturada &gt; 100 %.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm text-slate-500">Ocupación global</p>
          <p className="mt-1 text-4xl font-bold text-slate-900" data-testid="ocupacion-global">
            {inventario.ocupacionGlobal == null ? '—' : formatoPct(inventario.ocupacionGlobal)}
          </p>
          <div className="mt-2">
            <ChipNivel nivel={inventario.nivelOcupacionGlobal} />
          </div>
          <p className={`mt-2 text-xs ${inventario.productosSaturados > 0 ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-500'}`}>
            {inventario.productosSaturados > 0
              ? `${inventario.productosSaturados} producto${inventario.productosSaturados === 1 ? '' : 's'} sobre su capacidad`
              : 'Ningún producto sobre su capacidad'}
          </p>
        </div>

        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase text-slate-500">Por categoría</h4>
          {inventario.ocupacionPorCategoria.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Sin productos activos.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {inventario.ocupacionPorCategoria.map((c) => (
                <Barra
                  key={c.categoria}
                  etiqueta={c.categoria}
                  porcentaje={c.ocupacion}
                  nivel={c.nivelOcupacion}
                  detalle={`${formatoNumero(c.unidades)} de ${formatoNumero(c.capacidad)} u.`}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase text-slate-500">Productos más ocupados</h4>
          {masOcupados.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Sin productos activos.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {masOcupados.map((p) => (
                <Barra
                  key={p.productoId}
                  etiqueta={p.producto}
                  porcentaje={p.ocupacion}
                  nivel={p.nivelOcupacion}
                  detalle={`${formatoNumero(p.stockDisponible + p.stockReservado)} de ${formatoNumero(p.stockMaximo)} u.`}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
