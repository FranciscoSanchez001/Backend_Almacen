import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTema } from '../../context/ThemeContext'

// Piezas del dashboard KPI. Colores por rol (paleta categórica validada para
// daltonismo, en orden fijo, con sus pasos propios para el modo oscuro) y una
// sola escala por gráfico. Cada gráfico va en
// un contenedor responsivo que hace scroll horizontal en lugar de desbordarse,
// y trae su "Ver datos en tabla" para no depender del tooltip ni del color.
const CLARO = {
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  rejilla: '#e7e5e4',
  ejes: '#52514e',
  superficie: '#ffffff',
  vacio: '#f5f5f4',
  // Rampa secuencial (un solo tono): claro = poco, oscuro = mucho.
  rampa: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
}
// Modo oscuro: los mismos tonos, en los pasos validados para fondo oscuro. En la
// rampa, lo poco se funde con el fondo y lo mucho brilla.
const OSCURO = {
  series: ['#3987e5', '#d95926', '#199e70'],
  rejilla: '#2a3850',
  ejes: '#b4c0cf',
  superficie: '#162032',
  vacio: '#1e293b',
  rampa: ['#104281', '#184f95', '#256abf', '#2a78d6', '#3987e5', '#6da7ec', '#9ec5f4'],
}

function useColores() {
  return useTema().oscuro ? OSCURO : CLARO
}

const propsEje = (c) => ({ stroke: c.ejes, fontSize: 12, tickLine: false, axisLine: { stroke: c.rejilla } })

// Tooltip con las mismas tipografías del panel.
function CajaTooltip({ active, payload, label, formato, etiqueta }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-superficie px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{etiqueta ? etiqueta(label, payload) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} aria-hidden />
          {p.name}: <span className="font-semibold text-slate-900">{formato ? formato(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Marco de cada gráfico: título, nota y la tabla opcional con los mismos datos.
export function TarjetaGrafico({ titulo, detalle, tabla, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-superficie p-4 ${className}`}>
      <h3 className="font-semibold text-slate-900">{titulo}</h3>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
      <div className="mt-3 overflow-x-auto">{children}</div>
      {tabla && tabla.filas.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-marca-700 dark:text-marca-200">Ver datos en tabla</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-superficie text-slate-500">
                <tr>
                  {tabla.columnas.map((c) => (
                    <th key={c} className="py-1 pr-3 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabla.filas.map((fila, i) => (
                  <tr key={i}>
                    {fila.map((v, j) => (
                      <td key={j} className="py-1 pr-3 text-slate-700">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

// Tarjeta de un KPI: cifra principal, comparación con el período anterior (↑↓ %) y detalle.
export function TarjetaKpi({ titulo, valor, crecimiento, detalle, alerta }) {
  const sube = crecimiento > 0
  const igual = crecimiento == null || crecimiento === 0
  return (
    <div className="rounded-xl border border-slate-200 bg-superficie p-4">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${alerta ? 'text-red-700 dark:text-red-300' : 'text-slate-900'}`}>{valor}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {!igual && (
          <span className={`font-semibold ${sube ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
            {sube ? '↑' : '↓'} {Math.abs(crecimiento).toLocaleString('es-VE', { maximumFractionDigits: 1 })} %
          </span>
        )}
        {crecimiento === 0 && <span className="font-semibold text-slate-500">= 0 %</span>}
        {detalle && <span className="text-slate-500">{detalle}</span>}
      </div>
    </div>
  )
}

// Línea de tiempo de una sola serie (sin leyenda: el título la nombra).
export function GraficoLinea({ datos, x, y, nombre, formato, formatoX, alto = 260 }) {
  const c = useColores()
  const ejeProps = propsEje(c)
  return (
    <div style={{ minWidth: Math.max(320, datos.length * 28) }}>
      <ResponsiveContainer width="100%" height={alto}>
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.rejilla} vertical={false} />
          <XAxis dataKey={x} {...ejeProps} tickFormatter={formatoX} minTickGap={16} />
          <YAxis {...ejeProps} width={64} tickFormatter={formato} />
          <Tooltip content={<CajaTooltip formato={formato} etiqueta={formatoX} />} cursor={{ stroke: c.ejes, strokeWidth: 1 }} />
          <Line type="monotone" dataKey={y} name={nombre} stroke={c.series[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Barras horizontales (rankings). Una serie, o varias con leyenda.
export function BarrasHorizontales({ datos, categoria, series, formato }) {
  const c = useColores()
  const ejeProps = propsEje(c)
  const alto = Math.max(120, datos.length * (series.length > 1 ? 40 : 30) + 40)
  return (
    <div style={{ minWidth: 360 }}>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={c.rejilla} horizontal={false} />
          <XAxis type="number" {...ejeProps} tickFormatter={formato} />
          <YAxis type="category" dataKey={categoria} {...ejeProps} width={150} interval={0} />
          <Tooltip content={<CajaTooltip formato={formato} />} cursor={{ fill: c.vacio }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre} fill={c.series[i]} radius={[0, 4, 4, 0]} maxBarSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Dona para pocas partes de un total (métodos de pago: 3 porciones), con leyenda.
export function Dona({ datos, clave, nombre, formato }) {
  const c = useColores()
  const colores = c.series
  return (
    <div style={{ minWidth: 280 }}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={datos} dataKey={clave} nameKey={nombre} innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke={c.superficie} strokeWidth={2}>
            {datos.map((_, i) => (
              <Cell key={i} fill={colores[i % colores.length]} />
            ))}
          </Pie>
          <Tooltip content={<CajaTooltip formato={formato} etiqueta={(_, p) => p[0]?.name} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// Mapa de calor día × hora (7 × 24) con la rampa secuencial. Cada celda dice su valor al pasar el mouse.
export function MapaCalor({ matriz, dias }) {
  const { rampa: RAMPA, vacio } = useColores()
  const maximo = Math.max(1, ...matriz.flat())
  const color = (v) => (v === 0 ? vacio : RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / maximo) * (RAMPA.length - 1)))])
  return (
    <div className="min-w-[680px]">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: '84px repeat(24, minmax(0, 1fr))' }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[10px] text-slate-500">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {matriz.map((fila, d) => (
          <div key={d} className="contents">
            <span className="pr-2 text-right text-xs capitalize text-slate-600">{dias[d]}</span>
            {fila.map((v, h) => (
              <span
                key={h}
                title={`${dias[d]} ${h}:00 – ${v} ${v === 1 ? 'pedido' : 'pedidos'}`}
                aria-label={`${dias[d]} ${h}:00, ${v} pedidos`}
                className="h-6 rounded-sm"
                style={{ background: color(v) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
        Menos
        {RAMPA.map((c) => (
          <span key={c} className="h-3 w-5 rounded-sm" style={{ background: c }} />
        ))}
        Más (máx. {maximo})
      </div>
    </div>
  )
}
