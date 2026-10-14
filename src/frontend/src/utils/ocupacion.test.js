import { describe, expect, it } from 'vitest'
import { anchoBarra, nivelOcupacion } from './ocupacion'

describe('nivelOcupacion', () => {
  it.each([
    ['baja', 'Baja', 'caja'],
    ['optima', 'Óptima', 'check'],
    ['alta', 'Alta', 'alerta'],
    ['saturada', 'Saturada', 'agotado'],
  ])('%s lleva texto e ícono además del color', (nivel, texto, icono) => {
    const n = nivelOcupacion(nivel)

    expect(n.texto).toBe(texto)
    expect(n.icono).toBe(icono)
    expect(n.barra).toMatch(/^bg-/)
  })

  it('sin nivel (producto sin capacidad) devuelve un estado neutro', () => {
    expect(nivelOcupacion(null).texto).toBe('Sin capacidad')
  })
})

describe('anchoBarra', () => {
  it.each([
    [45, '45%'],
    [125, '100%'], // la barra no se desborda
    [-5, '0%'],
    [null, '0%'],
  ])('%s → %s', (porcentaje, ancho) => {
    expect(anchoBarra(porcentaje)).toBe(ancho)
  })
})
