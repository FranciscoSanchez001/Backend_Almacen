import { useEffect, useState } from 'react'
import Icono from './Icono'

// Tiempo que le queda a un pedido pendiente antes de expirar (5 h por defecto).
// Se pone ámbar en la última hora y rojo en los últimos 30 minutos.
export default function ContadorExpiracion({ expiraEn }) {
  const [ahora, setAhora] = useState(Date.now)

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const restante = new Date(expiraEn).getTime() - ahora
  if (restante <= 0) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Por expirar</span>
  }
  const min = Math.floor(restante / 60_000)
  const texto = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
  const clase =
    min < 30 ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' : min < 60 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}>
      <Icono nombre="reloj" className="h-3.5 w-3.5" /> Vence en {texto}
    </span>
  )
}
