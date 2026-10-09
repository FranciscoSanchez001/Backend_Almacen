import { describe, expect, it } from 'vitest'
import { ErrorApi } from '../api/cliente'
import { ESTADOS_PEDIDO, claseInput, erroresPorCampo } from './panel'

describe('erroresPorCampo', () => {
  it('convierte los errores de validación de la API a { campo: primer mensaje } en camelCase', () => {
    const error = new ErrorApi('Datos inválidos', 400, {
      errors: { PrecioUsd: ['El precio debe ser mayor que 0.', 'Otro mensaje'], Nombre: ['Requerido.'] },
    })

    expect(erroresPorCampo(error)).toEqual({
      precioUsd: 'El precio debe ser mayor que 0.',
      nombre: 'Requerido.',
    })
  })

  it('sin errores por campo devuelve el mensaje general', () => {
    const error = new ErrorApi('El SKU ya existe.', 409, { mensaje: 'El SKU ya existe.' })

    expect(erroresPorCampo(error)).toEqual({ general: 'El SKU ya existe.' })
  })

  it('funciona con errores sin datos (por ejemplo, de red)', () => {
    expect(erroresPorCampo(new ErrorApi('Sin conexión', 0, null))).toEqual({ general: 'Sin conexión' })
  })
})

describe('claseInput', () => {
  it('marca el campo en rojo solo cuando hay error', () => {
    expect(claseInput('Requerido')).toContain('border-red-400')
    expect(claseInput(undefined)).not.toContain('border-red-400')
  })
})

describe('ESTADOS_PEDIDO', () => {
  it('cada estado tiene nombre visible y estilo', () => {
    expect(Object.keys(ESTADOS_PEDIDO)).toEqual(expect.arrayContaining(['pendiente', 'en_camino', 'entregado']))
    for (const estado of Object.values(ESTADOS_PEDIDO)) {
      expect(estado.nombre).toBeTruthy()
      expect(estado.clase).toBeTruthy()
    }
  })
})
