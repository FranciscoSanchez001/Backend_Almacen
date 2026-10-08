import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { INICIO_POR_ROL } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import BotonTema from '../../components/BotonTema'

// Acceso INTERNO (personal: ventas, repartidor y gerente): solo correo y contraseña.
// El inicio de sesión de clientes con Google NO vive aquí: será un pop-up que se
// abrirá desde un botón "Iniciar sesión" en una esquina del catálogo.
// Se conecta con la API en POST /auth/login y redirige según el rol.
export default function LoginInterno() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const navegar = useNavigate()
  const { state } = useLocation()
  const { usuario, login } = useAuth()

  // Si ya hay sesión, directo a su área.
  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? '/'} replace />

  async function alEnviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const sesion = await login({ correo, clave })
      // Vuelve a la página que pedía antes del login, si es de su área.
      const inicio = INICIO_POR_ROL[sesion.rol] ?? '/'
      const desde = state?.desde
      const permitido = desde && (desde.startsWith(inicio) || (sesion.rol === 'superadmin' && desde.startsWith('/panel')))
      navegar(permitido ? desde : inicio, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-slate-50 p-6">
      <BotonTema className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Supermercado</h1>
          <p className="mt-1 text-sm text-slate-500">Acceso interno · Personal</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-superficie p-6 shadow-sm">
          <form onSubmit={alEnviar} className="space-y-4">
            <div>
              <label htmlFor="correo" className="mb-1 block text-sm font-medium text-slate-700">
                Correo
              </label>
              <input
                id="correo"
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tucorreo@almacen.local"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900"
              />
            </div>

            <div>
              <label htmlFor="clave" className="mb-1 block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="clave"
                type="password"
                required
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-center text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-slate-500">
            ¿Olvidaste tu contraseña? Comunícate con el administrador para recuperar tu acceso.
          </p>
        </div>
      </div>
    </main>
  )
}
