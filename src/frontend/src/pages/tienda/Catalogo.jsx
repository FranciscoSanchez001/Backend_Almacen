import { useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { listarCatalogo } from '../../api/catalogo'
import TarjetaProducto from '../../components/TarjetaProducto'

const TAMANO_PAGINA = 24

// Catálogo de la tienda: productos con stock, con búsqueda (?q=), filtro por
// categoría (?categoria=) y paginación (?pagina=). Los filtros llegan por la URL
// desde el encabezado (TiendaLayout).
export default function Catalogo() {
  const { categorias } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const categoriaId = params.get('categoria') ?? ''
  const pagina = Number(params.get('pagina')) || 1

  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true // Evita pintar la respuesta de una búsqueda que ya cambió.
    setCargando(true)
    setError(null)
    listarCatalogo({ q, categoriaId, pagina, tamano: TAMANO_PAGINA })
      .then((datos) => vigente && setResultado(datos))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [q, categoriaId, pagina, intento])

  function irAPagina(n) {
    const siguiente = new URLSearchParams(params)
    siguiente.set('pagina', n)
    setParams(siguiente)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoria = categorias.find((c) => c.id === categoriaId)
  const titulo = q ? `Resultados para “${q}”` : (categoria?.nombre ?? 'Todos los productos')
  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / TAMANO_PAGINA)) : 1
  const sinFiltros = !q && !categoriaId

  return (
    <div className="space-y-6">
      {sinFiltros && pagina === 1 && <Bienvenida />}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          {resultado && !cargando && (
            <p className="text-sm text-slate-500">
              {resultado.total} {resultado.total === 1 ? 'producto' : 'productos'}
            </p>
          )}
        </div>
        {!sinFiltros && (
          <Link to="/" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline">
            Quitar filtros
          </Link>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-center">
          <p className="font-semibold text-red-800 dark:text-red-300">No pudimos cargar el catálogo</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : cargando && !resultado ? (
        <Grilla>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[3/5] animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </Grilla>
      ) : resultado.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-superficie p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🔎
          </p>
          <p className="mt-2 font-semibold text-slate-800">No encontramos productos</p>
          <p className="text-sm text-slate-500">Prueba con otra palabra o revisa otra categoría.</p>
        </div>
      ) : (
        <>
          <Grilla atenuada={cargando}>
            {resultado.items.map((p) => (
              <TarjetaProducto key={p.id} producto={p} />
            ))}
          </Grilla>

          {totalPaginas > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => irAPagina(pagina - 1)}
                disabled={pagina <= 1}
                className="rounded-full border border-slate-300 bg-superficie px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-sm text-slate-600">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => irAPagina(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="rounded-full border border-slate-300 bg-superficie px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

function Grilla({ children, atenuada = false }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${
        atenuada ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      {children}
    </div>
  )
}

function Bienvenida() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-6 py-8 text-white sm:px-10 sm:py-12">
      <div className="relative z-10 max-w-lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-100">Tu mercado, sin salir de casa</p>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">Haz tu compra y te la llevamos</h2>
        <p className="mt-3 text-emerald-50">Precios en dólares y en bolívares a la tasa del día.</p>
      </div>
      <div aria-hidden className="absolute -right-6 -bottom-10 select-none text-[9rem] leading-none opacity-30 sm:right-10 sm:opacity-90">
        🥑🍞
      </div>
    </section>
  )
}
