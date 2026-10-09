import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Configuracion from './Configuracion'
import {
  actualizarZona,
  cargarTasa,
  crearZona,
  guardarConfiguracion,
  historialTasas,
  listarZonas,
  obtenerConfiguracion,
} from '../../api/configuracion'
import { ErrorApi } from '../../api/cliente'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/configuracion', () => ({
  obtenerConfiguracion: vi.fn(),
  guardarConfiguracion: vi.fn(),
  cargarTasa: vi.fn(),
  historialTasas: vi.fn(),
  listarZonas: vi.fn(),
  crearZona: vi.fn(),
  actualizarZona: vi.fn(),
}))

const config = {
  tasaBsUsd: 36.5,
  numeroSoporte: '+58 424 700 0000',
  horasExpiracion: 5,
  datosTransferencia: 'Banco de Venezuela 0102-...',
  datosPagoMovil: 'V-12345678 · 0414-1234567',
  walletBinance: 'TRX123',
  numerosPrueba: ['+584141111111', '+584142222222'],
}
// Desordenadas a propósito: la pantalla las ordena por nombre.
const zonas = [
  { id: 'z2', nombre: 'Pueblo Nuevo', activa: true },
  { id: 'z1', nombre: 'Centro', activa: true },
  { id: 'z3', nombre: 'La Concordia', activa: false },
]

function montar() {
  return renderizar(<Configuracion />, { ruta: '/admin/configuracion', rol: 'superadmin' })
}

const tarjeta = (titulo) => screen.getByRole('heading', { name: titulo }).closest('section')
const zona = (nombre) => within(tarjeta('Zonas de entrega')).getByText(new RegExp(nombre)).closest('li')

beforeEach(() => {
  vi.mocked(obtenerConfiguracion).mockReset().mockResolvedValue(config)
  vi.mocked(historialTasas).mockReset().mockResolvedValue({
    items: [{ id: 't1', tasa: 36.5, creadoEn: '2026-10-05T12:00:00Z', usuario: 'Gerente' }],
  })
  vi.mocked(listarZonas).mockReset().mockImplementation(() => Promise.resolve(zonas.map((z) => ({ ...z }))))
  vi.mocked(guardarConfiguracion).mockReset().mockResolvedValue(undefined)
  vi.mocked(cargarTasa).mockReset().mockResolvedValue(undefined)
  vi.mocked(crearZona).mockReset().mockResolvedValue(undefined)
  vi.mocked(actualizarZona).mockReset().mockResolvedValue(undefined)
})

describe('Configuracion: carga', () => {
  it('muestra la tasa actual, su historial, las zonas ordenadas y los datos generales', async () => {
    montar()

    expect(await screen.findByText('36.5 Bs', { selector: 'p' })).toBeInTheDocument()
    expect(await within(tarjeta('Tasa del día (Bs/USD)')).findByText(/Gerente/)).toBeInTheDocument()
    await within(tarjeta('Zonas de entrega')).findByText(/Centro/)
    const nombres = within(tarjeta('Zonas de entrega'))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('span').textContent.trim())
    expect(nombres).toEqual(['Centro', 'La Concordia (inactiva)', 'Pueblo Nuevo'])
    expect(screen.getByLabelText('Número de soporte')).toHaveValue('+58 424 700 0000')
    expect(screen.getByLabelText('Horas para que un pedido expire')).toHaveValue(5)
    expect(screen.getByLabelText('Números de prueba de WhatsApp')).toHaveValue('+584141111111\n+584142222222')
  })

  it('sin tasa cargada lo indica', async () => {
    vi.mocked(obtenerConfiguracion).mockResolvedValue({ ...config, tasaBsUsd: null })
    montar()

    expect(await screen.findByText('Sin cargar')).toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(obtenerConfiguracion)
      .mockRejectedValueOnce(new ErrorApi('No se pudo conectar con el servidor.', 0, null))
      .mockResolvedValueOnce(config)
    const { user } = montar()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('36.5 Bs', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('Configuracion: tasa del día', () => {
  it('rechaza una tasa vacía o en cero sin llamar a la API', async () => {
    const { user } = montar()
    const boton = await screen.findByRole('button', { name: 'Cargar tasa' })

    await user.click(boton)
    expect(screen.getByText('Escribe una tasa mayor que 0.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nueva tasa'), '0')
    expect(screen.queryByText('Escribe una tasa mayor que 0.')).not.toBeInTheDocument()
    await user.click(boton)
    expect(screen.getByText('Escribe una tasa mayor que 0.')).toBeInTheDocument()
    expect(cargarTasa).not.toHaveBeenCalled()
  })

  it('guarda la nueva tasa, avisa y recarga la configuración y el historial', async () => {
    const { user } = montar()
    await user.type(await screen.findByLabelText('Nueva tasa'), '37.25')

    await user.click(screen.getByRole('button', { name: 'Cargar tasa' }))

    expect(cargarTasa).toHaveBeenCalledWith(37.25)
    expect(await screen.findByRole('status')).toHaveTextContent('Tasa del día actualizada a 37.25 Bs/USD.')
    expect(screen.getByLabelText('Nueva tasa')).toHaveValue(null)
    expect(obtenerConfiguracion).toHaveBeenCalledTimes(2)
    expect(historialTasas).toHaveBeenCalledTimes(2)
  })

  it('si la API rechaza la tasa, muestra su mensaje en el campo', async () => {
    vi.mocked(cargarTasa).mockRejectedValue(new ErrorApi('La tasa no puede superar 1000.', 400, null))
    const { user } = montar()
    await user.type(await screen.findByLabelText('Nueva tasa'), '5000')

    await user.click(screen.getByRole('button', { name: 'Cargar tasa' }))

    expect(await screen.findByText('La tasa no puede superar 1000.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Configuracion: zonas de entrega', () => {
  it('agrega una zona con el nombre sin espacios sobrantes', async () => {
    const { user } = montar()
    await screen.findByText(/Centro/)
    const agregar = within(tarjeta('Zonas de entrega')).getByRole('button', { name: 'Agregar' })
    expect(agregar).toBeDisabled()

    await user.type(screen.getByLabelText('Nombre de la nueva zona'), '  Barrio Sucre ')
    await user.click(agregar)

    expect(crearZona).toHaveBeenCalledWith('Barrio Sucre')
    expect(await screen.findByRole('status')).toHaveTextContent('Se agregó la zona Barrio Sucre.')
    expect(screen.getByLabelText('Nombre de la nueva zona')).toHaveValue('')
    expect(listarZonas).toHaveBeenCalledTimes(2)
  })

  it('renombra una zona conservando si está activa', async () => {
    const { user } = montar()
    await screen.findByText(/Centro/)

    await user.click(within(zona('Centro')).getByRole('button', { name: 'Renombrar' }))
    const campo = screen.getByLabelText('Nombre de la zona')
    expect(campo).toHaveValue('Centro')
    await user.clear(campo)
    await user.type(campo, 'Casco Central')
    await user.click(within(tarjeta('Zonas de entrega')).getByRole('button', { name: 'Guardar' }))

    expect(actualizarZona).toHaveBeenCalledWith('z1', { nombre: 'Casco Central', activa: true })
    expect(await screen.findByRole('status')).toHaveTextContent('Zona renombrada.')
  })

  it('no permite guardar un nombre vacío y se puede cancelar la edición', async () => {
    const { user } = montar()
    await screen.findByText(/Centro/)

    await user.click(within(zona('Centro')).getByRole('button', { name: 'Renombrar' }))
    await user.clear(screen.getByLabelText('Nombre de la zona'))
    expect(within(tarjeta('Zonas de entrega')).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await user.click(within(tarjeta('Zonas de entrega')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Nombre de la zona')).not.toBeInTheDocument()
    expect(actualizarZona).not.toHaveBeenCalled()
  })

  it('desactiva una zona activa y activa una inactiva', async () => {
    const { user } = montar()
    await screen.findByText(/Centro/)

    await user.click(within(zona('Centro')).getByRole('button', { name: 'Desactivar' }))
    expect(actualizarZona).toHaveBeenCalledWith('z1', { nombre: 'Centro', activa: false })
    expect(await screen.findByRole('status')).toHaveTextContent('Centro quedó inactiva.')

    await user.click(within(zona('La Concordia')).getByRole('button', { name: 'Activar' }))
    expect(actualizarZona).toHaveBeenLastCalledWith('z3', { nombre: 'La Concordia', activa: true })
  })

  it('si la API falla, muestra el error en la tarjeta de zonas', async () => {
    vi.mocked(crearZona).mockRejectedValue(new ErrorApi('Ya existe una zona con ese nombre.', 409, null))
    const { user } = montar()
    await screen.findByText(/Centro/)

    await user.type(screen.getByLabelText('Nombre de la nueva zona'), 'Centro')
    await user.click(within(tarjeta('Zonas de entrega')).getByRole('button', { name: 'Agregar' }))

    expect(await within(tarjeta('Zonas de entrega')).findByText('Ya existe una zona con ese nombre.')).toBeInTheDocument()
  })
})

describe('Configuracion: soporte, pagos y expiración', () => {
  const guardar = () => within(tarjeta('Soporte, pagos y expiración')).getByRole('button', { name: 'Guardar' })

  it.each(['0', '169', '2.5'])('rechaza %s horas de expiración', async (horas) => {
    const { user } = montar()
    const campo = await screen.findByLabelText('Horas para que un pedido expire')

    await user.clear(campo)
    await user.type(campo, horas)
    await user.click(guardar())

    expect(screen.getByText('Entre 1 y 168 horas.')).toBeInTheDocument()
    expect(guardarConfiguracion).not.toHaveBeenCalled()
  })

  it('guarda los datos normalizados: vacíos como null y números de prueba por línea o coma', async () => {
    const { user } = montar()
    await screen.findByLabelText('Número de soporte')

    await user.clear(screen.getByLabelText('Número de soporte'))
    await user.clear(screen.getByLabelText('Wallet de Binance'))
    await user.type(screen.getByLabelText('Wallet de Binance'), '   ')
    const horas = screen.getByLabelText('Horas para que un pedido expire')
    await user.clear(horas)
    await user.type(horas, '12')
    const numeros = screen.getByLabelText('Números de prueba de WhatsApp')
    await user.clear(numeros)
    await user.type(numeros, '+584141111111, +584143333333{enter}{enter}+584144444444')
    await user.click(guardar())

    expect(guardarConfiguracion).toHaveBeenCalledWith({
      numeroSoporte: null,
      horasExpiracion: 12,
      datosTransferencia: 'Banco de Venezuela 0102-...',
      datosPagoMovil: 'V-12345678 · 0414-1234567',
      walletBinance: null,
      numerosPrueba: ['+584141111111', '+584143333333', '+584144444444'],
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración guardada.')
  })

  it('muestra los errores de validación de la API en su campo', async () => {
    vi.mocked(guardarConfiguracion).mockRejectedValue(
      new ErrorApi('Datos inválidos', 400, { errors: { NumeroSoporte: ['El número de soporte no es válido.'] } }),
    )
    const { user } = montar()
    await screen.findByLabelText('Número de soporte')

    await user.click(guardar())

    const mensaje = await screen.findByText('El número de soporte no es válido.')
    expect(mensaje.previousElementSibling).toBe(screen.getByLabelText('Número de soporte'))
  })

  it('un error sin campos aparece como mensaje general', async () => {
    vi.mocked(guardarConfiguracion).mockRejectedValue(new ErrorApi('No tienes permiso para hacer esto.', 403, null))
    const { user } = montar()
    await screen.findByLabelText('Número de soporte')

    await user.click(guardar())

    expect(await within(tarjeta('Soporte, pagos y expiración')).findByText('No tienes permiso para hacer esto.')).toBeInTheDocument()
  })
})
