import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cargarGoogle, mostrarBotonGoogle } from '../api/google'
import { useAuth } from '../context/AuthContext'

export default function LoginCliente({ alCerrar }) {
  const dialogo = useRef(null)
  const botonGoogle = useRef(null)
  const procesando = useRef(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const { loginGoogle } = useAuth()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    const elemento = dialogo.current
    const focoPrevio = document.activeElement
    elemento.showModal()
    return () => {
      elemento.close()
      focoPrevio?.focus()
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let activo = true
    let limpiar
    cargarGoogle().then((google) => {
      if (!activo) return
      limpiar = mostrarBotonGoogle(google, botonGoogle.current, clientId, async ({ credential }) => {
        if (!activo || procesando.current) return
        if (!credential) {
          setError('Google no devolvió una credencial. Inténtalo de nuevo.')
          return
        }
        procesando.current = true
        setEnviando(true)
        setError('')
        try {
          await loginGoogle(credential)
          if (activo) alCerrar()
        } catch (err) {
          if (activo) setError(err.message)
        } finally {
          procesando.current = false
          if (activo) setEnviando(false)
        }
      })
      setCargando(false)
    }).catch((err) => {
      if (activo) {
        setError(err.message)
        setCargando(false)
      }
    })
    return () => {
      activo = false
      limpiar?.()
    }
  }, [clientId, loginGoogle, alCerrar, intento])

  function reintentar() {
    setError('')
    setCargando(true)
    setIntento((valor) => valor + 1)
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-login-cliente"
      aria-describedby="descripcion-login-cliente"
      onCancel={(evento) => { evento.preventDefault(); if (!procesando.current) alCerrar() }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-superficie p-6 text-slate-900 shadow-xl backdrop:bg-black/50"
    >
      <button type="button" onClick={alCerrar} disabled={enviando} aria-label="Cerrar acceso de clientes"
        className="absolute right-3 top-3 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">✕</button>
      <h2 id="titulo-login-cliente" className="pr-6 text-xl font-bold">Ingresa a tu cuenta</h2>
      <p id="descripcion-login-cliente" className="mt-2 text-sm text-slate-500">Continúa con Google para ingresar o crear tu cuenta de cliente.</p>
      {!clientId ? (
        <p role="alert" className="mt-5 text-sm text-slate-600">El acceso con Google no está disponible en este momento. Inténtalo más tarde.</p>
      ) : (
        <div className="mt-6">
          {cargando && <p role="status" className="text-center text-sm text-slate-500">Cargando Google…</p>}
          <div ref={botonGoogle} hidden={enviando} className="flex justify-center" />
          {enviando && <p role="status" className="text-center text-sm text-slate-500">Ingresando…</p>}
          {error && <>
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
            <button type="button" onClick={reintentar} className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">Reintentar</button>
          </>}
        </div>
      )}
      <p className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        ¿Trabajas aquí? <Link to="/internal-login" className="font-medium text-emerald-700 dark:text-emerald-300">Acceso del personal</Link>
      </p>
    </dialog>
  )
}
