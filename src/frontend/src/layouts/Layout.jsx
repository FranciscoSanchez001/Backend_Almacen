import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import MenuPerfil from '../components/MenuPerfil'
import BotonTema from '../components/BotonTema'

// Layout común de las 4 áreas: encabezado del área + contenido.
// Las áreas del personal (panel, repartidor, admin) pasan `perfil` para mostrar el
// menú de cuenta en la esquina; la tienda (clientes) tendrá su propio acceso.
export default function Layout({ titulo, acento = 'text-slate-900', perfil = false }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <h1 className={`text-lg font-bold ${acento}`}>{titulo}</h1>
          {perfil && (
            <div className="ml-auto flex items-center gap-1">
              <BotonTema />
              <MenuPerfil />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<p className="py-10 text-center text-sm text-slate-500">Cargando…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
