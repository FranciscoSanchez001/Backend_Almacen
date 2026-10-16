import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { INICIO_POR_ROL } from '../api/auth'
import BotonGoogle from './BotonGoogle'
import Modal from './Modal'

// Acceso a la cuenta en la tienda. Los clientes entran con Google; si quien navega es del
// personal, solo se le ofrece volver a su panel (el personal no compra).
export default function MenuCliente() {
  const { usuario, logout } = useAuth()
  const [ingresando, setIngresando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (e) => !contenedor.current?.contains(e.target) && setAbierto(false)
    const alTecla = (e) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  if (!usuario) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIngresando(true)}
          className="text-sm font-medium text-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300"
        >
          Ingresar
        </button>
        <Modal abierto={ingresando} titulo="Ingresa a tu cuenta" alCerrar={() => setIngresando(false)} ancho="sm:max-w-sm">
          <p className="mb-5 text-center text-sm text-slate-600">
            Usa tu cuenta de Google para comprar y seguir tus pedidos. Si es tu primera vez, la cuenta se crea sola.
          </p>
          <BotonGoogle alIngresar={() => setIngresando(false)} />
          {/* El personal no entra con Google: tiene su propio acceso con correo y contraseña. */}
          <p className="mt-5 text-center text-xs text-slate-400">
            ¿Trabajas aquí?{' '}
            <Link
              to="/internal-login"
              onClick={() => setIngresando(false)}
              className="underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              Acceso del personal
            </Link>
          </p>
        </Modal>
      </>
    )
  }

  if (usuario.rol !== 'cliente') {
    return (
      <Link to={INICIO_POR_ROL[usuario.rol] ?? '/'} className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
        Ir a mi panel
      </Link>
    )
  }

  const inicial = usuario.nombre?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Mi cuenta"
        className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        {inicial}
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-superficie p-3 shadow-lg">
          <p className="truncate font-semibold text-slate-900">{usuario.nombre}</p>
          <p className="truncate text-sm text-slate-500">{usuario.email}</p>
          <Link
            to="/mis-pedidos"
            role="menuitem"
            onClick={() => setAbierto(false)}
            className="mt-3 block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Mis pedidos
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setAbierto(false)
              await logout()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
