import { Link } from 'react-router-dom'

// Página 404: cualquier ruta que no existe.
export default function NoEncontrada() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="text-center">
        <p className="text-5xl font-bold text-slate-300">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">Esta página no existe</h1>
        <p className="mt-1 text-slate-500">Puede que el enlace esté mal o que aún no la construyamos.</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-marca-700 px-4 py-2 text-sm font-medium text-white hover:bg-marca-800 dark:bg-marca-600 dark:hover:bg-marca-500"
        >
          Volver a la tienda
        </Link>
      </div>
    </main>
  )
}
