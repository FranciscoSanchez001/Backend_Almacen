import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Cupones from './Cupones'
import { renderizar, pagina } from '../../test/renderizar'
import { actualizarCupon, crearCupon, listarCupones } from '../../api/cupones'
import { ErrorApi } from '../../api/cliente'
import { diaAIso } from '../../utils/formato'

vi.mock('../../api/cupones', () => ({ listarCupones: vi.fn(), crearCupon: vi.fn(), actualizarCupon: vi.fn() }))

const cupon = (codigo, extra = {}) => ({
  id: `id-${codigo}`,
  codigo,
  descripcion: null,
  tipo: 'porcentaje',
  valor: 10,
  compraMinimaUsd: null,
  validoDesde: null,
  validoHasta: null,
  usosMaximos: null,
  usosActuales: 0,
  activo: true,
  vigente: true,
  creadoEn: '2026-10-01T12:00:00Z',
  ...extra,
})

const abrir = () => renderizar(<Cupones />, { ruta: '/admin/cupones', rol: 'superadmin' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarCupones).mockResolvedValue(
    pagina([
      cupon('VERANO10', { descripcion: 'Promo de verano', usosMaximos: 100, usosActuales: 7 }),
      cupon('FIJO5', {
        tipo: 'monto_fijo',
        valor: 5,
        compraMinimaUsd: 20,
        activo: false,
        vigente: false,
        validoDesde: diaAIso('2026-10-01'),
        validoHasta: diaAIso('2026-10-31', { fin: true }),
      }),
    ]),
  )
})

describe('Cupones: listado', () => {
  it('muestra cada cupón con su descuento, mínimo, vigencia, usos y estado', async () => {
    abrir()

    const verano = (await screen.findByText('VERANO10')).closest('tr')
    expect(within(verano).getByText('Promo de verano')).toBeInTheDocument()
    expect(within(verano).getByText('10 %')).toBeInTheDocument()
    expect(within(verano).getByText('Sin fecha límite')).toBeInTheDocument()
    expect(within(verano).getByText('7 / 100')).toBeInTheDocument()
    expect(within(verano).getByText('Vigente')).toBeInTheDocument()

    const fijo = screen.getByText('FIJO5').closest('tr')
    expect(within(fijo).getByText('$5.00')).toBeInTheDocument()
    expect(within(fijo).getByText('$20.00')).toBeInTheDocument()
    expect(within(fijo).getByText('Del 2026-10-01 al 2026-10-31')).toBeInTheDocument()
    expect(within(fijo).getByText('Inactivo')).toBeInTheDocument()
  })

  it('filtra por estado y por texto', async () => {
    const { user } = abrir()
    await screen.findByText('VERANO10')

    await user.click(screen.getByRole('button', { name: 'Inactivos' }))
    await waitFor(() => expect(listarCupones).toHaveBeenLastCalledWith(expect.objectContaining({ activo: false, pagina: 1 })))

    await user.type(screen.getByLabelText('Buscar cupones'), 'fijo')
    await waitFor(() => expect(listarCupones).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'fijo' })))
  })
})

describe('Cupones: crear y editar', () => {
  it('crea un cupón con código en mayúsculas, fechas por día y límite de usos', async () => {
    vi.mocked(crearCupon).mockResolvedValue(cupon('NAVIDAD'))
    const { user } = abrir()
    await screen.findByText('VERANO10')

    await user.click(screen.getByRole('button', { name: '+ Nuevo cupón' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo cupón' })
    await user.type(within(dialogo).getByLabelText('Código'), 'navidad')
    await user.selectOptions(within(dialogo).getByLabelText('Tipo'), 'monto_fijo')
    await user.type(within(dialogo).getByLabelText('Descuento (USD)'), '3')
    await user.type(within(dialogo).getByLabelText('Compra mínima (USD)'), '15')
    await user.type(within(dialogo).getByLabelText('Válido hasta (inclusive)'), '2026-12-31')
    await user.type(within(dialogo).getByLabelText('Límite de usos'), '50')
    await user.click(within(dialogo).getByRole('button', { name: 'Crear cupón' }))

    expect(crearCupon).toHaveBeenCalledWith({
      codigo: 'NAVIDAD',
      descripcion: null,
      tipo: 'monto_fijo',
      valor: 3,
      compraMinimaUsd: 15,
      validoDesde: null,
      validoHasta: diaAIso('2026-12-31', { fin: true }),
      usosMaximos: 50,
      activo: true,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Se creó el cupón NAVIDAD.')
  })

  it('valida antes de enviar', async () => {
    const { user } = abrir()
    await screen.findByText('VERANO10')

    await user.click(screen.getByRole('button', { name: '+ Nuevo cupón' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo cupón' })
    await user.type(within(dialogo).getByLabelText('Código'), 'X')
    await user.type(within(dialogo).getByLabelText('Descuento (%)'), '150')
    await user.click(within(dialogo).getByRole('button', { name: 'Crear cupón' }))

    expect(within(dialogo).getByText('El código debe tener al menos 3 caracteres.')).toBeInTheDocument()
    expect(within(dialogo).getByText('No puede pasar del 100 %.')).toBeInTheDocument()
    expect(crearCupon).not.toHaveBeenCalled()
  })

  it('un código repetido muestra el error de la API en el campo', async () => {
    vi.mocked(crearCupon).mockRejectedValue(new ErrorApi('Ya existe un cupón con el código VERANO10.', 409, {}))
    const { user } = abrir()
    await screen.findByText('VERANO10', { selector: 'span' })

    await user.click(screen.getByRole('button', { name: '+ Nuevo cupón' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo cupón' })
    await user.type(within(dialogo).getByLabelText('Código'), 'verano10')
    await user.type(within(dialogo).getByLabelText('Descuento (%)'), '10')
    await user.click(within(dialogo).getByRole('button', { name: 'Crear cupón' }))

    expect(await within(dialogo).findByText('Ya existe un cupón con el código VERANO10.')).toBeInTheDocument()
  })

  it('edita un cupón sin dejar cambiar el código y puede desactivarlo', async () => {
    vi.mocked(actualizarCupon).mockResolvedValue(cupon('VERANO10', { activo: false }))
    const { user } = abrir()

    const fila = (await screen.findByText('VERANO10')).closest('tr')
    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar cupón VERANO10' })
    expect(within(dialogo).getByLabelText('Código')).toBeDisabled()
    expect(within(dialogo).getByText('Usado 7 veces. Vacío = ilimitado.')).toBeInTheDocument()

    await user.click(within(dialogo).getByLabelText(/Activo/))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(actualizarCupon).toHaveBeenCalledWith('id-VERANO10', expect.objectContaining({ activo: false, valor: 10, usosMaximos: 100 }))
    expect(vi.mocked(actualizarCupon).mock.calls[0][1]).not.toHaveProperty('codigo')
  })
})
