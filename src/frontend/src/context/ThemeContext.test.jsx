import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTema } from './ThemeContext'

const usarTema = () => renderHook(() => useTema(), { wrapper: ThemeProvider }).result

// Simula la preferencia de color del sistema operativo.
function sistemaOscuro(oscuro) {
  vi.spyOn(window, 'matchMedia').mockImplementation((consulta) => ({
    matches: oscuro && consulta === '(prefers-color-scheme: dark)',
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe('ThemeContext: tema inicial', () => {
  it('sin preferencia guardada usa el tema claro si el sistema es claro', () => {
    sistemaOscuro(false)

    const tema = usarTema()

    expect(tema.current.tema).toBe('claro')
    expect(tema.current.oscuro).toBe(false)
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('sin preferencia guardada respeta el modo oscuro del sistema', () => {
    sistemaOscuro(true)

    const tema = usarTema()

    expect(tema.current.tema).toBe('oscuro')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('la preferencia guardada tiene prioridad sobre la del sistema', () => {
    sistemaOscuro(true)
    localStorage.setItem('almacen.tema', 'claro')

    const tema = usarTema()

    expect(tema.current.tema).toBe('claro')
  })

  it('ignora un valor guardado desconocido', () => {
    sistemaOscuro(true)
    localStorage.setItem('almacen.tema', 'morado')

    const tema = usarTema()

    expect(tema.current.tema).toBe('oscuro')
  })
})

describe('ThemeContext: cambios de tema', () => {
  it('alternar cambia entre claro y oscuro, aplica la clase dark y lo guarda', () => {
    sistemaOscuro(false)
    const tema = usarTema()

    act(() => tema.current.alternar())

    expect(tema.current.tema).toBe('oscuro')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('almacen.tema')).toBe('oscuro')

    act(() => tema.current.alternar())

    expect(tema.current.tema).toBe('claro')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('almacen.tema')).toBe('claro')
  })

  it('setTema fija un tema concreto', () => {
    sistemaOscuro(false)
    const tema = usarTema()

    act(() => tema.current.setTema('oscuro'))

    expect(tema.current.oscuro).toBe(true)
    expect(localStorage.getItem('almacen.tema')).toBe('oscuro')
  })
})
