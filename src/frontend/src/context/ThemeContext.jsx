import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Tema visual de la app: "claro" (institucional, Azul UNET #003366) u "oscuro".
// La elección se guarda en localStorage; si nunca se eligió, se respeta la
// preferencia del sistema operativo. El tema se aplica con la clase `dark` en
// <html> (ver index.css), y index.html la pone antes de pintar para evitar parpadeos.
const CLAVE = 'almacen.tema'
const ThemeContext = createContext(null)

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'claro' || guardado === 'oscuro') return guardado
  } catch {
    // Sin acceso a localStorage (modo privado estricto): se usa el del sistema.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      // Si no se puede guardar, el tema igual funciona en esta visita.
    }
  }, [tema])

  const alternar = useCallback(() => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')), [])

  const valor = useMemo(() => ({ tema, oscuro: tema === 'oscuro', setTema, alternar }), [tema, alternar])
  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema() {
  return useContext(ThemeContext)
}
