import { expect, it } from 'vitest'
import { enlaceMapa } from './entregas'

it('usa coordenadas precisas cuando existen, incluso valores cero', () => {
  expect(new URL(enlaceMapa({ latitud: 0, longitud: -72.2 })).searchParams.get('query')).toBe('0,-72.2')
})

it('busca la dirección y zona cuando no hay coordenadas', () => {
  const enlace = enlaceMapa({ direccionTexto: 'Casa azul #2 & panadería', zona: { nombre: 'Centro' }, latitud: null, longitud: null })
  expect(new URL(enlace).searchParams.get('query')).toBe('Casa azul #2 & panadería, Centro, Venezuela')
})
