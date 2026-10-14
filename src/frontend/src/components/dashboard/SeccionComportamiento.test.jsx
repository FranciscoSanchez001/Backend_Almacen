import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SeccionComportamiento from './SeccionComportamiento'
import { renderizar } from '../../test/renderizar'
import { obtenerComportamiento } from '../../api/analitica'

vi.mock('../../api/analitica', () => ({ obtenerComportamiento: vi.fn() }))

const datos = (extra = {}) => ({
  desde: '2026-10-12',
  hasta: '2026-10-18',
  zonaHoraria: 'America/Caracas',
  visitas: 200,
  busquedas: 80,
  busquedasSinResultados: 20,
  porcentajeSinResultados: 25,
  tasaConversion: 4.5,
  embudo: [
    { paso: 'Visitaron la tienda', sesiones: 200, porcentaje: 100 },
    { paso: 'Agregaron al carrito', sesiones: 60, porcentaje: 30 },
    { paso: 'Iniciaron el pago', sesiones: 30, porcentaje: 15 },
    { paso: 'Confirmaron el pedido', sesiones: 9, porcentaje: 4.5 },
  ],
  masBuscado: [{ texto: 'harina pan', veces: 30, sesiones: 25, resultados: 4 }],
  sinResultados: [{ texto: 'pañales', veces: 12, sesiones: 9, resultados: 0 }],
  productos: [{ productoId: 'p1', producto: 'Arroz', unidadesAgregadas: 40, sesiones: 20, unidadesVendidas: 10 }],
  categorias: [{ categoriaId: 'c1', categoria: 'Víveres', clics: 15, sesiones: 12 }],
  cupones: [{ codigo: 'VERANO10', aplicados: 7, rechazados: 3 }],
  porDia: [
    { dia: '2026-10-12', visitas: 100, busquedas: 40, pedidos: 5 },
    { dia: '2026-10-13', visitas: 100, busquedas: 40, pedidos: 4 },
  ],
  ...extra,
})

const periodo = { tipo: 'semanal', desde: '2026-10-13' }
const abrir = (p = periodo) => renderizar(<SeccionComportamiento periodo={p} />, { ruta: '/admin', rol: 'superadmin' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(obtenerComportamiento).mockResolvedValue(datos())
})

describe('SeccionComportamiento', () => {
  it('pide el período del dashboard y muestra los indicadores', async () => {
    abrir()

    expect(await screen.findByRole('heading', { name: 'Comportamiento de los visitantes' })).toBeInTheDocument()
    expect(await screen.findByText('sesiones distintas')).toBeInTheDocument()
    expect(obtenerComportamiento).toHaveBeenCalledWith(periodo)
    const tarjeta = (titulo) => screen.getByText(titulo, { selector: 'p' }).parentElement
    expect(tarjeta('Visitas')).toHaveTextContent('200')
    expect(tarjeta('Búsquedas sin resultados')).toHaveTextContent('25 %20 búsquedas')
    expect(tarjeta('Conversión')).toHaveTextContent('4,5 %')
  })

  it('muestra cuánto continúa entre cada paso del embudo', async () => {
    abrir()

    const pasos = within(await screen.findByRole('list', { name: 'Abandono entre pasos' })).getAllByRole('listitem')
    expect(pasos.map((p) => p.textContent)).toEqual([
      'Visitaron la tienda → agregaron al carrito30 % continúa',
      'Agregaron al carrito → iniciaron el pago50 % continúa',
      'Iniciaron el pago → confirmaron el pedido30 % continúa',
    ])
  })

  it('lista lo más buscado, lo buscado sin resultados y los cupones', async () => {
    abrir()

    const masBuscado = (await screen.findByRole('heading', { name: 'Lo más buscado' })).closest('section')
    expect(within(masBuscado).getByText('harina pan')).toBeInTheDocument()
    const sinResultados = screen.getByRole('heading', { name: 'Buscado sin resultados' }).closest('section')
    expect(within(sinResultados).getByText('pañales')).toBeInTheDocument()
    const cupones = screen.getByRole('heading', { name: 'Cupones que escriben los clientes' }).closest('section')
    expect(within(cupones).getByText('VERANO10')).toBeInTheDocument()
  })

  it('sin visitas lo explica y las listas vacías lo dicen', async () => {
    vi.mocked(obtenerComportamiento).mockResolvedValue(
      datos({ visitas: 0, masBuscado: [], sinResultados: [], productos: [], categorias: [], cupones: [] }),
    )
    abrir()

    expect(await screen.findByText(/Todavía no hay visitas registradas/)).toBeInTheDocument()
    expect(screen.getByText('Sin búsquedas en este período.')).toBeInTheDocument()
    expect(screen.getByText('Nadie agregó productos al carrito en este período.')).toBeInTheDocument()
  })

  it('vuelve a consultar cuando el dashboard cambia de período', async () => {
    const otro = { tipo: 'personalizado', desde: '2026-09-01', hasta: '2026-09-30' }
    function ConFiltro() {
      const [p, setP] = useState(periodo)
      return (
        <>
          <button type="button" onClick={() => setP(otro)}>Cambiar período</button>
          <SeccionComportamiento periodo={p} />
        </>
      )
    }
    const { user } = renderizar(<ConFiltro />, { ruta: '/admin', rol: 'superadmin' })
    await screen.findByText('sesiones distintas')

    await user.click(screen.getByRole('button', { name: 'Cambiar período' }))

    await vi.waitFor(() => expect(obtenerComportamiento).toHaveBeenLastCalledWith(otro))
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(obtenerComportamiento).mockRejectedValueOnce(new Error('Sin conexión'))
    const { user } = abrir()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('sesiones distintas')).toBeInTheDocument()
  })
})
