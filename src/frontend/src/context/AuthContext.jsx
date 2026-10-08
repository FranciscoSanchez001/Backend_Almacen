import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { obtenerToken } from '../api/cliente'
import { login as loginApi, cerrarSesion as cerrarSesionApi } from '../api/auth'

// Sesión del personal, centralizada. El usuario sale del propio token JWT
// (claims sub, name, email, role, exp), así que la sesión sobrevive a una
// recarga mientras el token siga guardado y vigente.
const AuthContext = createContext(null)

// Lee el payload del JWT (base64url). No valida la firma: eso lo hace la API.
function decodificarToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    const datos = JSON.parse(json)
    return {
      id: datos.sub,
      nombre: datos.name,
      email: datos.email,
      rol: datos.role,
      expiraEn: datos.exp * 1000,
    }
  } catch {
    return null
  }
}

function usuarioGuardado() {
  const token = obtenerToken()
  const usuario = token && decodificarToken(token)
  return usuario && usuario.expiraEn > Date.now() ? usuario : null
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(usuarioGuardado)

  // La API avisa con este evento cuando responde 401 (token vencido o usuario desactivado).
  useEffect(() => {
    const alExpirar = () => setUsuario(null)
    window.addEventListener('sesion-expirada', alExpirar)
    return () => window.removeEventListener('sesion-expirada', alExpirar)
  }, [])

  // Cierra la sesión sola cuando el token llega a su hora de vencimiento.
  useEffect(() => {
    if (!usuario) return
    const t = setTimeout(() => setUsuario(null), Math.max(0, usuario.expiraEn - Date.now()))
    return () => clearTimeout(t)
  }, [usuario])

  const login = useCallback(async (credenciales) => {
    const sesion = await loginApi(credenciales)
    const datos = decodificarToken(sesion.token)
    setUsuario(datos)
    return datos
  }, [])

  const logout = useCallback(async () => {
    await cerrarSesionApi()
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({
      usuario,
      login,
      logout,
      // ¿El usuario tiene alguno de estos roles?
      tieneRol: (...roles) => !!usuario && roles.includes(usuario.rol),
    }),
    [usuario, login, logout],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
