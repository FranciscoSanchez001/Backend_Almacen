import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { INICIO_POR_ROL } from '../api/auth'

// Deja pasar solo a los roles indicados (RBAC en el cliente).
// - Sin sesión: al login interno, recordando a dónde quería ir.
// - Con otro rol: a la pantalla de inicio de su propio rol.
// La API valida el rol de nuevo en cada endpoint; esto solo ordena la interfaz.
export default function RutaProtegida({ roles, children }) {
  const { usuario } = useAuth()
  const { pathname } = useLocation()

  if (!usuario) return <Navigate to="/internal-login" replace state={{ desde: pathname }} />
  if (!roles.includes(usuario.rol)) return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? '/'} replace />
  return children ?? <Outlet />
}
