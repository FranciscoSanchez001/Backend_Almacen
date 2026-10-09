import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContadorExpiracion from './ContadorExpiracion'

const AHORA = new Date('2026-10-08T12:00:00Z')
const enMinutos = (min) => new Date(AHORA.getTime() + min * 60_000).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
})

describe('ContadorExpiracion', () => {
  it('muestra horas y minutos cuando falta más de una hora', () => {
    render(<ContadorExpiracion expiraEn={enMinutos(4 * 60 + 15)} />)

    expect(screen.getByText(/Vence en 4 h 15 min/)).toBeInTheDocument()
  })

  it('muestra solo minutos en la última hora, con estilo de advertencia', () => {
    render(<ContadorExpiracion expiraEn={enMinutos(45)} />)

    const etiqueta = screen.getByText(/Vence en 45 min/)
    expect(etiqueta).toHaveClass('text-amber-800')
  })

  it('se marca en rojo en los últimos 30 minutos', () => {
    render(<ContadorExpiracion expiraEn={enMinutos(10)} />)

    expect(screen.getByText(/Vence en 10 min/)).toHaveClass('text-red-700')
  })

  it('indica "Por expirar" cuando el plazo ya venció', () => {
    render(<ContadorExpiracion expiraEn={enMinutos(-1)} />)

    expect(screen.getByText('Por expirar')).toBeInTheDocument()
  })

  it('se actualiza solo cada 30 segundos', () => {
    render(<ContadorExpiracion expiraEn={enMinutos(2)} />)
    expect(screen.getByText(/Vence en 2 min/)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText(/Vence en 1 min/)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Por expirar')).toBeInTheDocument()
  })
})
