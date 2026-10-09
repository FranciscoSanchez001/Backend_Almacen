import { beforeEach, describe, expect, it, vi } from 'vitest'
import { descargarExcel, obtenerKpis } from './reportes'

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn()
  vi.stubGlobal('fetch', fetchSimulado)
})

const url = () => new URL(fetchSimulado.mock.calls[0][0].toString())

// Respuesta de la API con el .xlsx y captura del enlace que dispara la descarga.
function prepararDescarga() {
  fetchSimulado.mockResolvedValue(
    new Response('xlsx', {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    }),
  )
  const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:informe')
  const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    descargas.push({ nombre: this.download, href: this.href })
  })
  const descargas = []
  return { descargas, crear, revocar, clic }
}

describe('obtenerKpis', () => {
  it('consulta los KPIs del período', async () => {
    fetchSimulado.mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await obtenerKpis({ tipo: 'diario', desde: '2026-10-05', hasta: '2026-10-05' })

    expect(url().pathname).toBe('/kpis')
    expect(Object.fromEntries(url().searchParams)).toEqual({ tipo: 'diario', desde: '2026-10-05', hasta: '2026-10-05' })
  })
})

describe('descargarExcel', () => {
  it.each([
    [{ tipo: 'diario', desde: '2026-10-05', hasta: '2026-10-05' }, 'informe_ventas_2026-10-05_diario.xlsx'],
    [{ tipo: 'semanal', desde: '2026-09-28', hasta: '2026-10-04' }, 'informe_ventas_2026-09-28_semanal.xlsx'],
    [{ tipo: 'mensual', desde: '2026-09-01', hasta: '2026-09-30' }, 'informe_ventas_2026-09_mensual.xlsx'],
    [{ tipo: 'personalizado', desde: '2026-09-10', hasta: '2026-09-20' }, 'informe_ventas_2026-09-10_a_2026-09-20_personalizado.xlsx'],
  ])('nombra el archivo según el período %j', async (periodo, nombre) => {
    const { descargas } = prepararDescarga()

    await descargarExcel(periodo)

    expect(url().pathname).toBe('/reportes/excel')
    expect(url().searchParams.get('tipo')).toBe(periodo.tipo)
    expect(descargas).toEqual([{ nombre, href: 'blob:informe' }])
  })

  it('libera la URL temporal del archivo después de la descarga', async () => {
    const { crear, revocar } = prepararDescarga()

    await descargarExcel({ tipo: 'diario', desde: '2026-10-05', hasta: '2026-10-05' })

    expect(crear.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(revocar).toHaveBeenCalledWith('blob:informe')
  })
})
