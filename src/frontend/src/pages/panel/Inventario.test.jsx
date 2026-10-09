import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Inventario from './Inventario'
import { listarInventario, listarMovimientos, reponer } from '../../api/inventario'
import { ErrorApi } from '../../api/cliente'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/inventario', () => ({ listarInventario: vi.fn(), listarMovimientos: vi.fn(), reponer: vi.fn() }))

const item = (extra) => ({
  productoId: 'p1',
  nombre: 'Arroz',
  codigoSku: 'VIV-0001',
  categoria: 'Víveres',
  ubicacion: 'P1-E1',
  stockDisponible: 20,
  stockReservado: 3,
  stockMinimo: 5,
  stockMaximo: 100,
  ...extra,
})

const arroz = item()
const leche = item({ productoId: 'p2', nombre: 'Leche', codigoSku: 'LAC-0001', categoria: 'Lácteos', ubicacion: null, stockDisponible: 0, stockReservado: 0 })
const harina = item({ productoId: 'p3', nombre: 'Harina', codigoSku: 'VIV-0002', stockDisponible: 2, stockReservado: 1 })
const agua = item({ productoId: 'p4', nombre: 'Agua', codigoSku: 'BEB-0001', categoria: 'Bebidas', stockDisponible: 150 })

const montar = () => renderizar(<Inventario />, { ruta: '/panel/inventario', rol: 'ventas' })
const fila = async (nombre) => (await screen.findByText(nombre)).closest('tr')
const filasVisibles = () => screen.getAllByRole('row').length - 1

beforeEach(() => {
  vi.mocked(listarInventario).mockReset().mockResolvedValue([arroz, leche, harina, agua])
  vi.mocked(listarMovimientos).mockReset()
  vi.mocked(reponer).mockReset()
})

describe('Inventario: listado y alertas', () => {
  it('muestra el stock disponible, el reservado, los umbrales y el estado de cada producto', async () => {
    montar()

    const f = await fila('Arroz')
    const celdas = within(f).getAllByRole('cell')
    expect(celdas[1]).toHaveTextContent('20')
    expect(celdas[2]).toHaveTextContent('3')
    expect(celdas[3]).toHaveTextContent('5 / 100')
    expect(within(f).getByText(/VIV-0001/)).toBeInTheDocument()
    expect(f).toHaveTextContent('Víveres · P1-E1')
    expect(within(f).getByText('Normal')).toBeInTheDocument()
    expect(within(await fila('Leche')).getByText('Agotado')).toBeInTheDocument()
    expect(within(await fila('Harina')).getByText('Bajo mínimo')).toBeInTheDocument()
    expect(within(await fila('Agua')).getByText('Sobre máximo')).toBeInTheDocument()
  })

  it('resume cuántos productos están agotados, bajo el mínimo y sobre el máximo', async () => {
    vi.mocked(listarInventario).mockResolvedValue([arroz, leche, item({ productoId: 'p5', nombre: 'Café', stockDisponible: 0 }), harina, agua])
    montar()
    await screen.findByText('Arroz')

    const tarjeta = (titulo) => screen.getByText(titulo).parentElement
    expect(tarjeta('⛔ Agotados')).toHaveTextContent('2')
    expect(tarjeta('⚠️ Bajo el mínimo')).toHaveTextContent('1')
    expect(tarjeta('📦 Sobre el máximo')).toHaveTextContent('1')
  })

  it('si la API falla muestra el error y permite reintentar', async () => {
    vi.mocked(listarInventario).mockRejectedValueOnce(new ErrorApi('No se pudo conectar con el servidor.', 0, null))
    const { user } = montar()

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Arroz')).toBeInTheDocument()
  })
})

describe('Inventario: filtros', () => {
  it.each([
    ['Agotados', 'Leche'],
    ['Bajo mínimo', 'Harina'],
    ['Sobre máximo', 'Agua'],
  ])('el filtro "%s" muestra solo %s', async (filtro, nombre) => {
    const { user } = montar()
    await screen.findByText('Arroz')
    const grupo = screen.getByRole('group', { name: 'Filtrar por alerta' })

    await user.click(within(grupo).getByRole('button', { name: filtro }))

    expect(within(grupo).getByRole('button', { name: filtro })).toHaveAttribute('aria-pressed', 'true')
    expect(filasVisibles()).toBe(1)
    expect(screen.getByText(nombre)).toBeInTheDocument()
  })

  it('busca por nombre o SKU sin distinguir mayúsculas', async () => {
    const { user } = montar()
    await screen.findByText('Arroz')
    const buscador = screen.getByRole('searchbox', { name: 'Buscar en el inventario' })

    await user.type(buscador, 'lac-')
    expect(filasVisibles()).toBe(1)
    expect(screen.getByText('Leche')).toBeInTheDocument()

    await user.clear(buscador)
    await user.type(buscador, 'HARINA')
    expect(screen.getByText('Harina')).toBeInTheDocument()
    expect(filasVisibles()).toBe(1)
  })

  it('combina filtro y búsqueda, y sin coincidencias muestra el mensaje vacío', async () => {
    const { user } = montar()
    await screen.findByText('Arroz')

    await user.click(screen.getByRole('button', { name: 'Agotados' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en el inventario' }), 'arroz')

    expect(screen.getByText('Ningún producto coincide.')).toBeInTheDocument()
  })
})

describe('Inventario: reposición', () => {
  it('abre el modal con el stock actual y la cantidad sugerida para llegar al máximo', async () => {
    const { user } = montar()

    await user.click(within(await fila('Harina')).getByRole('button', { name: 'Reponer' }))

    const modal = screen.getByRole('dialog', { name: 'Reponer · Harina' })
    expect(modal).toHaveTextContent('Hay 2 disponibles (mín. 5, máx. 100).')
    expect(within(modal).getByText('Para llegar al máximo faltan 98.')).toBeInTheDocument()
  })

  it('rechaza una cantidad vacía con un mensaje en el campo', async () => {
    const { user } = montar()
    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Reponer' }))
    const modal = screen.getByRole('dialog')

    await user.click(within(modal).getByRole('button', { name: 'Reponer' }))

    expect(within(modal).getByText('Escribe una cantidad entera mayor que 0.')).toBeInTheDocument()
    expect(reponer).not.toHaveBeenCalled()
  })

  // El formulario no usa noValidate: el navegador bloquea el envío por min="1" y step="1"
  // antes de llegar a la validación propia.
  it.each([
    ['cero', '0'],
    ['decimal', '2.5'],
  ])('no envía una cantidad %s', async (_caso, valor) => {
    const { user } = montar()
    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Reponer' }))
    const modal = screen.getByRole('dialog')
    const campo = within(modal).getByLabelText('Cantidad que llegó')

    await user.type(campo, valor)
    await user.click(within(modal).getByRole('button', { name: 'Reponer' }))

    expect(campo).toBeInvalid()
    expect(reponer).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('repone la cantidad, cierra el modal, avisa y recarga el inventario', async () => {
    vi.mocked(reponer).mockResolvedValue(null)
    const { user } = montar()
    await user.click(within(await fila('Leche')).getByRole('button', { name: 'Reponer' }))
    const modal = screen.getByRole('dialog')
    vi.mocked(listarInventario).mockResolvedValue([arroz, { ...leche, stockDisponible: 24 }, harina, agua])

    await user.type(within(modal).getByLabelText('Cantidad que llegó'), '24')
    await user.click(within(modal).getByRole('button', { name: 'Reponer' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se sumaron 24 unidades a Leche.')
    expect(reponer).toHaveBeenCalledWith('p2', 24)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByText('Leche').closest('tr')).getByText('Normal')).toBeInTheDocument())
  })

  it('si la API rechaza la reposición muestra el error en el campo', async () => {
    vi.mocked(reponer).mockRejectedValue(new ErrorApi('El producto no existe.', 404, null))
    const { user } = montar()
    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Reponer' }))
    const modal = screen.getByRole('dialog')

    await user.type(within(modal).getByLabelText('Cantidad que llegó'), '5')
    await user.click(within(modal).getByRole('button', { name: 'Reponer' }))

    expect(await within(modal).findByText('El producto no existe.')).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Reponer' })).toBeEnabled()
  })
})

describe('Inventario: movimientos', () => {
  it('muestra el historial de movimientos del producto', async () => {
    vi.mocked(listarMovimientos).mockResolvedValue(
      pagina([
        { id: 'm1', creadoEn: '2026-10-05T14:30:00Z', tipo: 'reposicion', cantidad: 20, disponibleAntes: 0, disponibleDespues: 20, usuario: 'Gerente' },
        { id: 'm2', creadoEn: '2026-10-06T10:00:00Z', tipo: 'reserva', cantidad: -3, disponibleAntes: 20, disponibleDespues: 17, usuario: null },
      ]),
    )
    const { user } = montar()

    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Movimientos' }))

    const modal = screen.getByRole('dialog', { name: 'Movimientos · Arroz' })
    expect(await within(modal).findByText('Reposición')).toBeInTheDocument()
    expect(within(modal).getByText('+20')).toBeInTheDocument()
    expect(within(modal).getByText('0 → 20')).toBeInTheDocument()
    expect(within(modal).getByText('Gerente')).toBeInTheDocument()
    expect(within(modal).getByText('Reserva')).toBeInTheDocument()
    expect(within(modal).getByText('-3')).toBeInTheDocument()
    expect(within(modal).getByText('Sistema')).toBeInTheDocument()
    expect(listarMovimientos).toHaveBeenCalledWith('p1', { pagina: 1, tamano: 15 })
  })

  it('sin movimientos muestra el mensaje vacío', async () => {
    vi.mocked(listarMovimientos).mockResolvedValue(pagina([]))
    const { user } = montar()

    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Movimientos' }))

    expect(await within(screen.getByRole('dialog')).findByText('Sin movimientos todavía.')).toBeInTheDocument()
  })

  it('si falla la carga de movimientos muestra el error', async () => {
    vi.mocked(listarMovimientos).mockRejectedValue(new ErrorApi('No se encontró lo que buscas.', 404, null))
    const { user } = montar()

    await user.click(within(await fila('Arroz')).getByRole('button', { name: 'Movimientos' }))

    expect(await within(screen.getByRole('dialog')).findByText('No se encontró lo que buscas.')).toBeInTheDocument()
  })
})
