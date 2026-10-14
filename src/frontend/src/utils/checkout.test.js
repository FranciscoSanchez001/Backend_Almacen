import { describe, expect, it } from 'vitest'
import { normalizarTelefono, validarCaptura } from './checkout'

describe('validación del checkout', () => {
  it.each(['0412 123 4567', '+58 (412) 123-4567', '4121234567'])('normaliza el celular venezolano %s', telefono => {
    expect(normalizarTelefono(telefono)).toBe('+584121234567')
  })
  it.each(['', '1234', '+573001234567', '02121234567'])('rechaza el teléfono %s', telefono => {
    expect(normalizarTelefono(telefono)).toBeNull()
  })
  it('acepta una imagen en el límite y rechaza archivos vacíos, grandes o con otro formato', () => {
    expect(validarCaptura({ type: 'image/png', size: 5 * 1024 * 1024 })).toBe('')
    expect(validarCaptura({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).not.toBe('')
    expect(validarCaptura({ type: 'image/png', size: 0 })).not.toBe('')
    expect(validarCaptura({ type: 'application/pdf', size: 10 })).not.toBe('')
    expect(validarCaptura(null)).not.toBe('')
  })
})
