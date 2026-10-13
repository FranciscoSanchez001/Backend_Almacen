import { useEffect, useMemo, useState } from 'react'
import { obtenerComportamiento } from '../../api/analitica'
import { EncabezadoPagina, EstadoCarga, Selector } from '../../components/ui'
import { BarrasHorizontales, GraficoLinea, TarjetaGrafico, TarjetaKpi } from '../../components/dashboard/Graficos'
import { claseInput } from '../../utils/panel'
import { formatoDia, formatoNumero, formatoPct, hoyIso } from '../../utils/formato'

// Comportamiento de los visitantes de la tienda (GET /analitica/comportamiento): qué buscan,
// qué no encuentran, cuántos llegan a comprar y qué agregan al carrito sin comprarlo.
// Los datos son anónimos; el personal no se cuenta. Mismos períodos que el dashboard KPI.
const PERIODOS = [
  ['diario', 'Hoy'],
  ['semanal', 'Esta semana'],
  ['mensual', 'Este mes'],
  ['personalizado', 'Personalizado'],
]

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}

// Tabla simple para listas de texto (búsquedas, cupones): el texto es el dato, no cabe en un gráfico.
function Tabla({ titulo, detalle, columnas, filas, vacio }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-superficie p-4">
      <h3 className="font-semibold text-slate-900">{titulo}</h3>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{vacio}</p>
      ) : (
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-superficie text-xs uppercase text-slate-500">
              <tr>
                {columnas.map((c, i) => (
                  <th key={c} className={`py-1.5 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((v, j) => (
                    <td key={j} className={`py-1.5 pr-3 ${j > 0 ? 'text-right tabular-nums text-slate-700' : 'font-medium text-slate-900'}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function Comportamiento() {
  const [tipo, setTipo] = useState('semanal')
  const [desde, setDesde] = useState(hoyIso())
  const [hasta, setHasta] = useState(hoyIso())
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)

  const periodo = useMemo(
    () => (tipo === 'personalizado' ? { tipo, desde, hasta } : { tipo, desde: hoyIso() }),
    [tipo, desde, hasta],
  )
  const rangoInvalido = tipo === 'personalizado' && (!desde || !hasta || desde > hasta)

  useEffect(() => {
    if (rangoInvalido) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerComportamiento(periodo)
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [periodo, rangoInvalido, intento])

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Comportamiento en la tienda"
        detalle="Qué buscan los visitantes, qué no encuentran y en qué paso abandonan la compra."
      />

      <div className="flex flex-wrap items-end gap-3">
        <Selector etiqueta="Período" opciones={PERIODOS} valor={tipo} alCambiar={setTipo} />
        {tipo === 'personalizado' && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput(rangoInvalido)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseInput(rangoInvalido)} />
            </label>
            {rangoInvalido && <p className="text-xs text-red-600 dark:text-red-300">El inicio debe ser anterior o igual al fin.</p>}
          </>
        )}
      </div>

      <EstadoCarga cargando={cargando && !datos} error={error} alReintentar={() => setIntento((n) => n + 1)}>
        {datos && <Resumen datos={datos} atenuado={cargando} />}
      </EstadoCarga>
    </div>
  )
}

function Resumen({ datos, atenuado }) {
  const embudo = datos.embudo
  const sinDatos = datos.visitas === 0

  return (
    <div className={`space-y-8 ${atenuado ? 'opacity-60' : ''}`}>
      {sinDatos && (
        <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Todavía no hay visitas registradas en este período. Los datos aparecen a medida que los clientes usan la tienda.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi titulo="Visitas" valor={formatoNumero(datos.visitas)} detalle="sesiones distintas" />
        <TarjetaKpi titulo="Búsquedas" valor={formatoNumero(datos.busquedas)} />
        <TarjetaKpi
          titulo="Búsquedas sin resultados"
          valor={formatoPct(datos.porcentajeSinResultados)}
          detalle={`${formatoNumero(datos.busquedasSinResultados)} búsquedas`}
          alerta={datos.porcentajeSinResultados >= 20}
        />
        <TarjetaKpi titulo="Conversión" valor={formatoPct(datos.tasaConversion)} detalle="visitas que terminan en pedido" />
      </div>

      <Seccion titulo="Embudo de compra">
        <TarjetaGrafico
          titulo="Sesiones que llegan a cada paso"
          detalle="Cada barra es una parte de la anterior: la diferencia es quien abandonó en ese paso."
          tabla={{
            columnas: ['Paso', 'Sesiones', '% de las visitas'],
            filas: embudo.map((p) => [p.paso, formatoNumero(p.sesiones), formatoPct(p.porcentaje)]),
          }}
        >
          <BarrasHorizontales datos={embudo} categoria="paso" series={[{ clave: 'sesiones', nombre: 'Sesiones' }]} formato={formatoNumero} />
        </TarjetaGrafico>
        <ol aria-label="Abandono entre pasos" className="grid gap-2 text-sm sm:grid-cols-3">
          {embudo.slice(1).map((p, i) => {
            const anterior = embudo[i].sesiones
            const pasan = anterior ? (p.sesiones / anterior) * 100 : 0
            return (
              <li key={p.paso} className="rounded-lg border border-slate-200 bg-superficie px-3 py-2">
                <span className="text-slate-500">{embudo[i].paso} → {p.paso.toLowerCase()}</span>
                <span className="block font-semibold text-slate-900">{formatoPct(Math.round(pasan * 10) / 10)} continúa</span>
              </li>
            )
          })}
        </ol>
      </Seccion>

      <Seccion titulo="Actividad por día">
        <TarjetaGrafico
          titulo="Visitas por día"
          tabla={{
            columnas: ['Día', 'Visitas', 'Búsquedas', 'Pedidos'],
            filas: datos.porDia.map((d) => [formatoDia(d.dia), d.visitas, d.busquedas, d.pedidos]),
          }}
        >
          <GraficoLinea datos={datos.porDia} x="dia" y="visitas" nombre="Visitas" formato={formatoNumero} formatoX={formatoDia} />
        </TarjetaGrafico>
      </Seccion>

      <Seccion titulo="Búsquedas">
        <div className="grid gap-4 lg:grid-cols-2">
          <Tabla
            titulo="Lo más buscado"
            columnas={['Búsqueda', 'Veces', 'Resultados']}
            filas={datos.masBuscado.map((b) => [b.texto, formatoNumero(b.veces), formatoNumero(b.resultados)])}
            vacio="Sin búsquedas en este período."
          />
          <Tabla
            titulo="Buscado sin resultados"
            detalle="Productos que piden y no tienes, o que se escriben distinto en el catálogo."
            columnas={['Búsqueda', 'Veces', 'Visitantes']}
            filas={datos.sinResultados.map((b) => [b.texto, formatoNumero(b.veces), formatoNumero(b.sesiones)])}
            vacio="Todas las búsquedas encontraron algo."
          />
        </div>
      </Seccion>

      <Seccion titulo="Productos y categorías">
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaGrafico
            titulo="Agregados al carrito vs. vendidos"
            detalle="Unidades. Mucho agregado y poco vendido suele indicar un problema de precio o de stock."
            tabla={{
              columnas: ['Producto', 'Agregadas', 'Vendidas', 'Visitantes'],
              filas: datos.productos.map((p) => [p.producto, p.unidadesAgregadas, p.unidadesVendidas, p.sesiones]),
            }}
          >
            {datos.productos.length === 0 ? (
              <p className="text-sm text-slate-500">Nadie agregó productos al carrito en este período.</p>
            ) : (
              <BarrasHorizontales
                datos={datos.productos}
                categoria="producto"
                series={[
                  { clave: 'unidadesAgregadas', nombre: 'Agregadas' },
                  { clave: 'unidadesVendidas', nombre: 'Vendidas' },
                ]}
                formato={formatoNumero}
              />
            )}
          </TarjetaGrafico>
          <TarjetaGrafico
            titulo="Categorías más visitadas"
            detalle="Veces que se abrió cada categoría."
            tabla={{ columnas: ['Categoría', 'Clics', 'Visitantes'], filas: datos.categorias.map((c) => [c.categoria, c.clics, c.sesiones]) }}
          >
            {datos.categorias.length === 0 ? (
              <p className="text-sm text-slate-500">Nadie filtró por categoría en este período.</p>
            ) : (
              <BarrasHorizontales datos={datos.categorias} categoria="categoria" series={[{ clave: 'clics', nombre: 'Clics' }]} formato={formatoNumero} />
            )}
          </TarjetaGrafico>
        </div>
      </Seccion>

      <Seccion titulo="Cupones">
        <Tabla
          titulo="Cupones que escriben los clientes"
          detalle="Los rechazados incluyen códigos que no existen, vencidos o que no alcanzan la compra mínima."
          columnas={['Código', 'Aplicados', 'Rechazados']}
          filas={datos.cupones.map((c) => [c.codigo, formatoNumero(c.aplicados), formatoNumero(c.rechazados)])}
          vacio="Nadie intentó usar cupones en este período."
        />
      </Seccion>

      <p className="text-xs text-slate-500">
        Datos anónimos (sin IP ni datos personales), en hora de {datos.zonaHoraria}. Se borran solos pasado un tiempo (180 días por defecto). Una visita es una sesión del
        navegador que termina tras 30 minutos sin actividad; no se cuenta al personal ni a quien activó «No rastrear».
      </p>
    </div>
  )
}
