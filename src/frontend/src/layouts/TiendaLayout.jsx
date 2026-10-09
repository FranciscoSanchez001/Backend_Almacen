import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { listarCategorias } from '../api/catalogo'
import { useCarrito } from '../context/CarritoContext'
import BotonTema from '../components/BotonTema'
import { formatoUsd } from '../utils/formato'
import Icono from '../components/Icono'

// Layout de la tienda al estilo de un supermercado en línea: franja de avisos,
// encabezado con logo + buscador + carrito, y la barra de categorías.
// Los filtros viven en la URL (?q=...&categoria=...) para que el buscador del
// encabezado y la barra de categorías manejen la misma vista del catálogo.
export default function TiendaLayout() {
  const [categorias, setCategorias] = useState([])
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { totalUnidades, totalUsd } = useCarrito()
  const categoriaActiva = params.get('categoria')

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([])) // Sin categorías la tienda sigue funcionando.
  }, [])

  function alBuscar(e) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q').trim()
    navegar(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-emerald-800 text-xs text-emerald-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
          <span className="flex items-center gap-1.5">
            <Icono nombre="camion" /> Entregas a domicilio en tu zona
          </span>
          <span className="hidden sm:inline">Paga con transferencia, pago móvil o Binance</span>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-superficie shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <Icono nombre="carrito" className="h-6 w-6" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold text-emerald-700 dark:text-emerald-300">Almacén</span>
              <span className="block text-xs text-slate-500">Supermercado en línea</span>
            </span>
          </Link>

          <form onSubmit={alBuscar} role="search" className="order-last flex w-full sm:order-none sm:flex-1">
            <input
              key={params.get('q') ?? ''}
              name="q"
              type="search"
              defaultValue={params.get('q') ?? ''}
              placeholder="¿Qué estás buscando? Ej.: harina, arroz, café…"
              aria-label="Buscar productos"
              className="min-w-0 flex-1 rounded-l-full border border-r-0 border-slate-300 bg-slate-50 px-5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
            />
            <button
              type="submit"
              className="rounded-r-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Buscar
            </button>
          </form>

          <div className="ml-auto flex items-center gap-4 sm:ml-0">
            <BotonTema />
            <button type="button" className="text-sm font-medium text-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300">
              Ingresar
            </button>
            <button
              type="button"
              className="relative flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
              aria-label={`Carrito: ${totalUnidades} productos`}
            >
              <Icono nombre="canasta" className="h-5 w-5" />
              <span>{formatoUsd(totalUsd)}</span>
              {totalUnidades > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs text-white">
                  {totalUnidades}
                </span>
              )}
            </button>
          </div>
        </div>

        <nav aria-label="Categorías" className="border-t border-slate-100">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm">
            <li>
              <NavLink
                to="/"
                end
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 font-medium ${
                  !categoriaActiva ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todo
              </NavLink>
            </li>
            {categorias.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/?categoria=${c.id}`}
                  className={`block whitespace-nowrap rounded-full px-3 py-1.5 font-medium ${
                    categoriaActiva === c.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet context={{ categorias }} />
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-superficie">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} Almacén · San Cristóbal, Táchira
        </div>
      </footer>
    </div>
  )
}
