import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Whatsapp from './Whatsapp'
import { renderizar } from '../../test/renderizar'
import {
  desvincularWhatsapp,
  enviarPruebaWhatsapp,
  listarMensajesWhatsapp,
  obtenerEstadoWhatsapp,
  vincularWhatsapp,
} from '../../api/whatsapp'
import { obtenerConfiguracion } from '../../api/configuracion'
import { ErrorApi } from '../../api/cliente'

vi.mock('../../api/whatsapp', () => ({
  obtenerEstadoWhatsapp: vi.fn(),
  vincularWhatsapp: vi.fn(),
  desvincularWhatsapp: vi.fn(),
  enviarPruebaWhatsapp: vi.fn(),
  listarMensajesWhatsapp: vi.fn(),
}))
vi.mock('../../api/configuracion', () => ({ obtenerConfiguracion: vi.fn() }))

const estado = (extra = {}) => ({
  configurado: true,
  disponible: true,
  estado: 'desconectado',
  qr: null,
  numero: null,
  nombre: null,
  mensaje: null,
  ...extra,
})
const QR = 'data:image/png;base64,AAAA'
const abrir = () => renderizar(<Whatsapp />, { ruta: '/admin/whatsapp', rol: 'superadmin' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(obtenerEstadoWhatsapp).mockResolvedValue(estado())
  vi.mocked(obtenerConfiguracion).mockResolvedValue({ numerosPrueba: ['+584121234567'] })
  vi.mocked(listarMensajesWhatsapp).mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('WhatsApp (admin)', () => {
  it('sin teléfono vinculado ofrece vincular y muestra el QR', async () => {
    vi.mocked(vincularWhatsapp).mockResolvedValue(estado({ estado: 'esperando_qr', qr: QR }))
    const { user } = abrir()

    await user.click(await screen.findByRole('button', { name: 'Vincular teléfono' }))

    expect(vincularWhatsapp).toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'Código QR para vincular WhatsApp' })).toHaveAttribute('src', QR)
    expect(screen.getByText('Esperando escaneo')).toBeInTheDocument()
    expect(screen.getByText('Dispositivos vinculados')).toBeInTheDocument()
  })

  it('mientras espera el escaneo consulta el estado seguido y muestra la conexión', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(obtenerEstadoWhatsapp)
      .mockResolvedValueOnce(estado({ estado: 'esperando_qr', qr: QR }))
      .mockResolvedValue(estado({ estado: 'conectado', numero: '584241112233', nombre: 'Almacén' }))
    abrir()
    await screen.findByRole('img', { name: 'Código QR para vincular WhatsApp' })

    await act(() => vi.advanceTimersByTimeAsync(3100))

    expect(await screen.findByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('Vinculado: +584241112233 · Almacén')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Código QR/ })).not.toBeInTheDocument()
  })

  it('conectado permite desvincular', async () => {
    vi.mocked(obtenerEstadoWhatsapp).mockResolvedValue(estado({ estado: 'conectado', numero: '584241112233' }))
    vi.mocked(desvincularWhatsapp).mockResolvedValue(estado())
    const { user } = abrir()

    await user.click(await screen.findByRole('button', { name: 'Desvincular teléfono' }))

    expect(desvincularWhatsapp).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Vincular teléfono' })).toBeInTheDocument()
  })

  it('envía un mensaje de prueba con el teléfono conectado', async () => {
    vi.mocked(obtenerEstadoWhatsapp).mockResolvedValue(estado({ estado: 'conectado', numero: '584241112233' }))
    vi.mocked(enviarPruebaWhatsapp).mockResolvedValue(undefined)
    const { user } = abrir()

    await user.type(await screen.findByLabelText('Teléfono'), '+58 412 123 4567')
    await user.click(screen.getByRole('button', { name: 'Enviar prueba' }))

    expect(enviarPruebaWhatsapp).toHaveBeenCalledWith('+58 412 123 4567')
    expect(await screen.findByText('Mensaje de prueba enviado a +58 412 123 4567.')).toBeInTheDocument()
  })

  it('sin teléfono vinculado no deja enviar la prueba', async () => {
    const { user } = abrir()
    await user.type(await screen.findByLabelText('Teléfono'), '+58 412 123 4567')

    expect(screen.getByRole('button', { name: 'Enviar prueba' })).toBeDisabled()
  })

  it('muestra el motivo si la prueba falla', async () => {
    vi.mocked(obtenerEstadoWhatsapp).mockResolvedValue(estado({ estado: 'conectado', numero: '584241112233' }))
    vi.mocked(enviarPruebaWhatsapp).mockRejectedValue(new ErrorApi('El número +584121234567 no tiene WhatsApp.', 502, null))
    const { user } = abrir()

    await user.type(await screen.findByLabelText('Teléfono'), '+58 412 123 4567')
    await user.click(screen.getByRole('button', { name: 'Enviar prueba' }))

    expect(await screen.findByText('El número +584121234567 no tiene WhatsApp.')).toBeInTheDocument()
  })

  it('avisa si el servicio de WhatsApp no está disponible', async () => {
    vi.mocked(obtenerEstadoWhatsapp).mockResolvedValue(
      estado({ disponible: false, mensaje: 'No se pudo contactar al servicio de WhatsApp: Connection refused' }),
    )
    abrir()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo contactar al servicio de WhatsApp')
    expect(screen.queryByRole('button', { name: 'Vincular teléfono' })).not.toBeInTheDocument()
  })

  it('muestra los números de prueba con el enlace para editarlos', async () => {
    abrir()

    expect(await screen.findByText('+584121234567')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar en Configuración' })).toHaveAttribute('href', '/admin/configuracion')
  })

  it('sin números de prueba avisa que nadie recibirá mensajes', async () => {
    vi.mocked(obtenerConfiguracion).mockResolvedValue({ numerosPrueba: [] })
    abrir()

    expect(await screen.findByText(/ningún cliente recibirá mensajes/)).toBeInTheDocument()
  })

  it('lista los últimos mensajes con su estado', async () => {
    vi.mocked(listarMensajesWhatsapp).mockResolvedValue([
      {
        id: 'm1',
        numeroPedido: 579,
        telefono: '+584121234567',
        plantilla: 'en_camino',
        texto: 'Tu pedido #579 ya va en camino.',
        estado: 'enviado',
        error: null,
        creadoEn: '2026-10-14T22:38:51Z',
      },
      {
        id: 'm2',
        numeroPedido: 580,
        telefono: '+584149998877',
        plantilla: 'recibido',
        texto: 'Recibimos tu pedido #580.',
        estado: 'bloqueado_lista_blanca',
        error: null,
        creadoEn: '2026-10-14T22:40:00Z',
      },
    ])
    abrir()

    const lista = (await screen.findByText('Pedido #579 · En camino')).closest('ul')
    expect(within(lista).getByText('Enviado')).toBeInTheDocument()
    expect(within(lista).getByText('Pedido #580 · Recibido')).toBeInTheDocument()
    expect(within(lista).getByText('Fuera de la lista de prueba')).toBeInTheDocument()
  })
})
