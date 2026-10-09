// Configuración común de las pruebas: matchers de DOM (toBeInTheDocument...) y limpieza
// entre pruebas, para que ninguna herede el DOM, el localStorage ni los mocks de otra.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
