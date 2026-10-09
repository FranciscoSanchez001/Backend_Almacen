import { describe, expect, it } from 'vitest'
import { alertaStock } from './stock'

const producto = (stockDisponible) => ({ stockDisponible, stockMinimo: 5, stockMaximo: 100 })

describe('alertaStock', () => {
  it.each([
    [0, 'Agotado'],
    [4, 'Bajo mínimo'],
    [5, 'Normal'],
    [100, 'Normal'],
    [101, 'Sobre máximo'],
  ])('con stock %i indica "%s"', (stock, texto) => {
    expect(alertaStock(producto(stock)).texto).toBe(texto)
  })

  it('cada estado incluye un ícono además del color', () => {
    for (const stock of [0, 4, 50, 101]) {
      const alerta = alertaStock(producto(stock))
      expect(alerta.icono).toBeTruthy()
      expect(alerta.clase).toBeTruthy()
    }
  })
})
