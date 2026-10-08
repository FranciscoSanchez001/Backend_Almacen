import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import MenuPerfil from '../components/MenuPerfil'
import BotonTema from '../components/BotonTema'
import { useAuth } from '../context/AuthContext'
import { listarNotificaciones } from '../api/notificaciones'

// Layout de los paneles del personal (ventas y gerente).
// - Escritorio (lg+): barra lateral fija a la izquierda.
// - Móvil: la barra lateral se abre como cajón con el botón ☰.
// El menú se arma según el rol: ventas ve "Ventas"; el gerente (superadmin)
// ve todo lo de ventas más "Administración" (ver especificación, roles y permisos).
const icono = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const SECCIONES = [
  {
    titulo: 'Ventas',
    roles: ['ventas', 'superadmin'],
    opciones: [
      { ruta: '/panel', fin: true, titulo: 'Resumen', detalle: 'Lo urgente del día', icono: icono('M3 12h4l3-8 4 16 3-8h4') },
      { ruta: '/panel/pedidos', titulo: 'Pedidos', detalle: 'Bandeja y seguimiento', icono: icono('M9 5h6m-6 4h6m-6 4h4M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z') },
      { ruta: '/panel/productos', titulo: 'Productos', detalle: 'Catálogo y categorías', icono: icono('M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4') },
      { ruta: '/panel/inventario', titulo: 'Inventario', detalle: 'Stock y reposición', icono: icono('M4 6h16M4 12h16M4 18h10') },
      { ruta: '/panel/clientes', titulo: 'Clientes', detalle: 'Historial de compras', icono: icono('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0') },
    ],
  },
  {
    titulo: 'Administración',
    roles: ['superadmin'],
    opciones: [
      { ruta: '/admin', fin: true, titulo: 'Dashboard KPI', detalle: 'Indicadores y Excel', icono: icono('M4 20V10m6 10V4m6 16v-7m4 7H2') },
      { ruta: '/admin/personal', titulo: 'Personal', detalle: 'Vendedores y repartidores', icono: icono('M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74') },
      { ruta: '/admin/auditoria', titulo: 'Auditoría', detalle: 'Quién cambió qué', icono: icono('M9 12l2 2 4-4m5 2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z') },
      { ruta: '/admin/configuracion', titulo: 'Configuración', detalle: 'Tasa, zonas y pagos', icono: icono('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z') },
    ],
  },
]

function Navegacion({ rol, alElegir }) {
  return (
    <nav aria-label="Menú del panel" className="space-y-5 overflow-y-auto p-3">
      {SECCIONES.filter((s) => s.roles.includes(rol)).map((seccion) => (
        <div key={seccion.titulo} className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{seccion.titulo}</p>
          {seccion.opciones.map((op) => (
            <NavLink
              key={op.ruta}
              to={op.ruta}
              end={op.fin}
              onClick={alElegir}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isActive ? 'bg-marca-50 dark:bg-marca-700/40 text-marca-700 dark:text-marca-200' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {op.icono}
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{op.titulo}</span>
                <span className="block truncate text-xs text-slate-500">{op.detalle}</span>
              </span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function Marca({ rol }) {
  return (
    <Link to={rol === 'superadmin' ? '/admin' : '/panel'} className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca-700 dark:bg-marca-600 text-sm font-bold text-white">S</span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900">Supermercado</span>
        <span className="block text-xs text-marca-600 dark:text-marca-200">{rol === 'superadmin' ? 'Administración' : 'Panel de ventas'}</span>
      </span>
    </Link>
  )
}

// Campana con la cantidad de avisos sin leer. Se actualiza cada minuto y al cambiar de página.
function Campana() {
  const [sinLeer, setSinLeer] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    let vigente = true
    const cargar = () =>
      listarNotificaciones()
        .then((r) => vigente && setSinLeer(r.total))
        .catch(() => {}) // La campana no debe romper la pantalla.
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => {
      vigente = false
      clearInterval(t)
    }
  }, [pathname])

  return (
    <Link
      to="/panel#avisos"
      aria-label={`Avisos sin leer: ${sinLeer}`}
      className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
      </svg>
      {sinLeer > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
          {sinLeer > 99 ? '99+' : sinLeer}
        </span>
      )}
    </Link>
  )
}

export default function PanelLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { pathname } = useLocation()
  const { usuario } = useAuth()

  // Al cambiar de página se cierra el cajón en móvil.
  useEffect(() => setMenuAbierto(false), [pathname])

  // Con el cajón abierto: Escape lo cierra y el fondo no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return
    const alTecla = (e) => e.key === 'Escape' && setMenuAbierto(false)
    document.addEventListener('keydown', alTecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTecla)
      document.body.style.overflow = ''
    }
  }, [menuAbierto])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Barra lateral fija (escritorio) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-superficie lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">
          <Marca rol={usuario.rol} />
        </div>
        <Navegacion rol={usuario.rol} />
      </aside>

      {/* Cajón (móvil) */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-superficie shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <Marca rol={usuario.rol} />
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <Navegacion rol={usuario.rol} alElegir={() => setMenuAbierto(false)} />
          </aside>
        </div>
      )}

      {/* Contenido */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-superficie px-4">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="lg:hidden">
            <Marca rol={usuario.rol} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <BotonTema />
            <Campana />
            <MenuPerfil />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">
          <Suspense fallback={<p className="py-10 text-center text-sm text-slate-500">Cargando…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
