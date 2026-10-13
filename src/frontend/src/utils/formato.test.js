import { describe, expect, it, vi } from 'vitest'
import { formatoBs, formatoDia, formatoMinutos, formatoNumero, formatoPct, formatoUsd, hoyIso, diaAIso, isoADia } from './formato'

describe('formato de montos', () => {
  it('formatoUsd usa el símbolo de dólar y dos decimales', () => {
    expect(formatoUsd(1234.5)).toBe('$1,234.50')
  })

  it('formatoBs antepone "Bs" con separadores venezolanos', () => {
    expect(formatoBs(1234.5)).toBe('Bs 1.234,50')
  })

  it('formatoNumero redondea a dos decimales con coma decimal', () => {
    expect(formatoNumero(1234.567)).toBe('1.234,57')
  })

  it('formatoPct agrega el signo de porcentaje', () => {
    expect(formatoPct(12.5)).toBe('12,5 %')
  })
})

describe('formatoDia', () => {
  // El separador depende de la versión de ICU del navegador; lo importante es el día y el mes.
  it('muestra el día y el mes abreviado sin desplazar la fecha', () => {
    const texto = formatoDia('2026-10-05')
    expect(texto).toMatch(/^05/)
    expect(texto).toMatch(/oct/)
  })

  it('no corre al día anterior el primer día del mes', () => {
    expect(formatoDia('2026-11-01')).toMatch(/^01.*nov/)
  })
})

describe('formatoMinutos', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h 0 min'],
    [86, '1 h 26 min'],
    [0, '0 min'],
  ])('%i minutos → "%s"', (minutos, esperado) => {
    expect(formatoMinutos(minutos)).toBe(esperado)
  })

  it('sin valor devuelve un guion largo', () => {
    expect(formatoMinutos(null)).toBe('—')
    expect(formatoMinutos(undefined)).toBe('—')
  })
})

describe('hoyIso', () => {
  it('devuelve la fecha local en formato yyyy-MM-dd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 7, 23, 30))

    expect(hoyIso()).toBe('2026-01-07')
  })
})

describe('vigencias por día', () => {
  it('diaAIso da la medianoche local del día, o la del día siguiente para el fin', () => {
    expect(new Date(diaAIso('2026-10-20')).getTime()).toBe(new Date(2026, 9, 20).getTime())
    expect(new Date(diaAIso('2026-10-31', { fin: true })).getTime()).toBe(new Date(2026, 10, 1).getTime())
  })

  it('isoADia es el inverso de diaAIso, también para el fin inclusive', () => {
    expect(isoADia(diaAIso('2026-10-20'))).toBe('2026-10-20')
    expect(isoADia(diaAIso('2026-12-31', { fin: true }), { fin: true })).toBe('2026-12-31')
  })

  it('sin fecha devuelve null o vacío', () => {
    expect(diaAIso('')).toBeNull()
    expect(isoADia(null)).toBe('')
  })
})
