// Configuración común de las pruebas: matchers de DOM (toBeInTheDocument...) y limpieza
// entre pruebas, para que ninguna herede el DOM, el localStorage ni los mocks de otra.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// APIs del navegador que jsdom no implementa y que usa la app:
// - matchMedia: tema inicial según la preferencia del sistema (ThemeContext).
// - ResizeObserver: ResponsiveContainer de Recharts (dashboard).
// - scrollTo: desplazamiento al cambiar de página o de filtro.
// - URL.createObjectURL / revokeObjectURL: descarga del informe en Excel.
if (!window.matchMedia) {
  window.matchMedia = (consulta) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

window.scrollTo = () => {}
window.HTMLElement.prototype.scrollIntoView = function () {}

if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:prueba'
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
