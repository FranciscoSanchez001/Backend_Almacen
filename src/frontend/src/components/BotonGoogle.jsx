import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Botón "Continuar con Google" de Google Identity Services (GIS). Google entrega un ID token
// (credential) que se manda a POST /auth/google; la API lo valida contra el mismo Client ID
// (Google:ClientId) y devuelve la sesión del cliente.
// El script de Google se descarga una sola vez y solo cuando se muestra el botón.
const URL_SCRIPT = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let cargaScript = null

function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve()
  cargaScript ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = URL_SCRIPT
    script.async = true
    const fallar = () => {
      clearTimeout(timeout)
      script.remove()
      cargaScript = null // Permite reintentar.
      rechazar(new Error('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.'))
    }
    const timeout = setTimeout(fallar, 15000)
    script.onload = () => {
      if (!window.google?.accounts?.id) return fallar()
      clearTimeout(timeout)
      resolver()
    }
    script.onerror = fallar
    document.head.appendChild(script)
  })
  return cargaScript
}

export default function BotonGoogle({ alIngresar }) {
  const contenedor = useRef(null)
  const { loginConGoogle } = useAuth()
  const [error, setError] = useState(CLIENT_ID ? null : 'El inicio de sesión con Google no está configurado (VITE_GOOGLE_CLIENT_ID).')
  const [entrando, setEntrando] = useState(false)
  const procesando = useRef(false)

  // La última versión de los callbacks, sin volver a inicializar Google en cada render.
  const alIngresarRef = useRef(alIngresar)
  useEffect(() => {
    alIngresarRef.current = alIngresar
  })

  useEffect(() => {
    if (!CLIENT_ID) return
    let vigente = true
    cargarScriptGoogle()
      .then(() => {
        if (!vigente || !contenedor.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            if (!vigente || procesando.current) return
            if (!credential) { setError('Google no devolvió una credencial. Inténtalo de nuevo.'); return }
            procesando.current = true
            setEntrando(true)
            setError(null)
            try {
              const usuario = await loginConGoogle(credential)
              if (vigente) alIngresarRef.current?.(usuario)
            } catch (e) {
              if (vigente) setError(e.message)
            } finally {
              procesando.current = false
              if (vigente) setEntrando(false)
            }
          },
        })
        const oscuro = document.documentElement.classList.contains('dark')
        window.google.accounts.id.renderButton(contenedor.current, {
          theme: oscuro ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'es',
        })
      })
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [loginConGoogle])

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={contenedor} className={entrando ? 'pointer-events-none opacity-50' : ''} />
      {entrando && <p className="text-sm text-slate-500">Entrando…</p>}
      {error && (
        <p role="alert" className="text-center text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
