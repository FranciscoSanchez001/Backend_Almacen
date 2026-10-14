import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import LoginCliente from './LoginCliente'
import { useAuth } from '../context/AuthContext'

export default function AccesoCliente({ children }) {
  const { usuario } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])
  if (usuario?.rol === 'cliente') return children
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-superficie p-8 text-center">
      <h1 className="text-2xl font-bold">Acceso de clientes</h1>
      <p className="mt-3 text-slate-600">{usuario ? 'Para comprar necesitas ingresar con una cuenta de cliente. Cierra la sesión del personal para continuar.' : 'Ingresa con Google para continuar con tu compra y consultar tus pedidos.'}</p>
      {!usuario && <button type="button" onClick={() => setAbierto(true)} className="mt-5 rounded-full bg-emerald-600 px-6 py-2.5 font-semibold text-white hover:bg-emerald-700">Ingresar con Google</button>}
      <Link to="/" className="mt-5 block text-sm text-emerald-700 dark:text-emerald-300">Volver a la tienda</Link>
      {abierto && <LoginCliente alCerrar={cerrar} />}
    </section>
  )
}
