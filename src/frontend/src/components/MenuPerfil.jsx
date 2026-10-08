import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Menú de cuenta del personal (superadmin, ventas, repartidor): un círculo con las
// iniciales en la esquina que despliega los datos de la cuenta y "Cerrar sesión".
// La tienda (clientes) tendrá su propio acceso con Google; este menú no se usa allí.
const ROLES = {
  superadmin: {
    nombre: 'Administrador',
    detalle: 'Acceso total: dashboard, usuarios, configuración, auditoría y todo lo del panel de ventas.',
    color: 'bg-violet-600',
    etiqueta: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300',
  },
  ventas: {
    nombre: 'Ventas',
    detalle: 'Gestiona pedidos, pagos, productos y stock.',
    color: 'bg-sky-600',
    etiqueta: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
  },
  repartidor: {
    nombre: 'Repartidor',
    detalle: 'Ve y actualiza los pedidos que tiene asignados para entregar.',
    color: 'bg-orange-600',
    etiqueta: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
  },
}

function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

export default function MenuPerfil() {
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const contenedor = useRef(null)
  const navegar = useNavigate()
  const { usuario, logout } = useAuth()

  // Cerrar el menú al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!abierto) return
    function alClic(e) {
      if (!contenedor.current?.contains(e.target)) setAbierto(false)
    }
    function alTecla(e) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  if (!usuario) {
    return (
      <Link to="/internal-login" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline">
        Iniciar sesión
      </Link>
    )
  }

  const rol = ROLES[usuario.rol] ?? { nombre: usuario.rol, detalle: '', color: 'bg-slate-600', etiqueta: 'bg-slate-100 text-slate-700' }

  async function alSalir() {
    setSaliendo(true)
    await logout()
    navegar('/internal-login', { replace: true })
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Mi cuenta"
        className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-slate-100"
      >
        <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white ${rol.color}`}>
          {iniciales(usuario.nombre)}
        </span>
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">Mi cuenta</span>
      </button>

      {abierto && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-superficie p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold text-white ${rol.color}`}>
              {iniciales(usuario.nombre)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{usuario.nombre}</p>
              <p className="truncate text-sm text-slate-500">{usuario.email}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tipo de cuenta</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${rol.etiqueta}`}>
              {rol.nombre}
            </span>
            {rol.detalle && <p className="mt-2 text-xs text-slate-600">{rol.detalle}</p>}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={alSalir}
            disabled={saliendo}
            className="mt-4 w-full rounded-lg border border-red-200 dark:border-red-900 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
          >
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  )
}
