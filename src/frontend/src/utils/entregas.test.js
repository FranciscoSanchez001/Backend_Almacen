import { expect, it } from 'vitest'
import { enlacesMapa } from './entregas'

it('usa coordenadas precisas cuando existen, incluso valores cero', () => {
  const enlaces = enlacesMapa({ latitud: 0, longitud: -72.2 })
  expect(new URL(enlaces.google).searchParams.get('query')).toBe('0,-72.2')
  expect(new URL(enlaces.waze).searchParams.get('ll')).toBe('0,-72.2')
})

it('busca la dirección y zona cuando no hay coordenadas', () => {
  const enlaces = enlacesMapa({ direccionTexto: 'Casa azul #2 & panadería', zona: { nombre: 'Centro' }, latitud: null, longitud: null })
  expect(new URL(enlaces.google).searchParams.get('query')).toBe('Casa azul #2 & panadería, Centro, Venezuela')
  expect(new URL(enlaces.waze).searchParams.get('q')).toBe('Casa azul #2 & panadería, Centro, Venezuela')
})
