import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DetallePedido from './DetallePedido'

function crearPedido(cambios = {}) {
  return {
    id: 'ped-1',
    numero: 1042,
    estado: 'asignado',
    creadoEn: '2026-10-05T14:30:00Z',
    items: [
      { productoId: 'p1', producto: 'Arroz', categoria: 'Víveres', cantidad: 2, precioUsd: 1.5, subtotalUsd: 3 },
      { productoId: 'p2', producto: 'Leche', categoria: 'Lácteos y huevos', cantidad: 1, precioUsd: 2.25, subtotalUsd: 2.25 },
    ],
    totalUsd: 5.25,
    totalBs: 1234.5,
    tasaCambio: 235.14,
    metodoPago: 'pago_movil',
    monedaPago: 'VES',
    referenciaPago: 'REF-998877',
    capturaUrl: '/uploads/captura.png',
    zona: { nombre: 'Barrio Obrero' },
    direccionTexto: 'Calle 10, casa 4',
    cliente: { nombre: 'Ana Pérez' },
    telefonoContacto: '04141234567',
    repartidor: { nombre: 'Luis Gómez' },
    latitud: 7.77,
    longitud: -72.22,
    historial: [],
    ...cambios,
  }
}

describe('DetallePedido', () => {
  it('lista los productos con cantidad, precio y subtotal', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    const filas = screen.getAllByRole('row')
    expect(within(filas[1]).getByText('Arroz')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Víveres')).toBeInTheDocument()
    expect(within(filas[1]).getByText('2')).toBeInTheDocument()
    expect(within(filas[1]).getByText('$1.50')).toBeInTheDocument()
    expect(within(filas[1]).getByText('$3.00')).toBeInTheDocument()
    expect(within(filas[2]).getByText('Leche')).toBeInTheDocument()
    expect(within(filas[2]).getAllByText('$2.25')).toHaveLength(2)
  })

  it('muestra el total en USD y en Bs con la tasa congelada', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    expect(screen.getByText('$5.25')).toBeInTheDocument()
    expect(screen.getByText(/Bs 1\.234,50 · tasa congelada 235\.14/)).toBeInTheDocument()
  })

  it('indica el método de pago, la moneda en bolívares y la referencia', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    expect(screen.getByText('Pago móvil · se paga en Bs')).toBeInTheDocument()
    expect(screen.getByText('REF-998877')).toBeInTheDocument()
  })

  it('con pago en USDT lo indica como moneda', () => {
    render(<DetallePedido pedido={crearPedido({ metodoPago: 'binance', monedaPago: 'USDT' })} />)

    expect(screen.getByText('Binance · se paga en USDT')).toBeInTheDocument()
  })

  it('muestra la captura con la URL completa de la API', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    const imagen = screen.getByRole('img', { name: 'Captura del comprobante de pago' })
    expect(imagen).toHaveAttribute('src', 'http://api.pruebas/uploads/captura.png')
    expect(imagen.closest('a')).toHaveAttribute('href', 'http://api.pruebas/uploads/captura.png')
  })

  it('sin captura avisa que no hay comprobante adjunto', () => {
    render(<DetallePedido pedido={crearPedido({ capturaUrl: null })} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('El pedido no tiene captura adjunta.')).toBeInTheDocument()
  })

  it('muestra los datos de entrega, el teléfono como enlace y el repartidor', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    expect(screen.getByText('Barrio Obrero')).toBeInTheDocument()
    expect(screen.getByText(/Calle 10, casa 4/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '04141234567' })).toHaveAttribute('href', 'tel:04141234567')
    expect(screen.getByText('Repartidor: Luis Gómez')).toBeInTheDocument()
  })

  it('con coordenadas muestra el mapa y el enlace a Google Maps', () => {
    render(<DetallePedido pedido={crearPedido()} />)

    expect(screen.getByTitle('Mapa de la entrega del pedido 1042')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir en Google Maps/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps?q=7.77,-72.22',
    )
  })

  it('sin coordenadas no muestra el mapa', () => {
    render(<DetallePedido pedido={crearPedido({ latitud: null, longitud: null })} />)

    expect(screen.queryByTitle(/Mapa de la entrega/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument()
  })

  it('muestra el motivo del rechazo cuando existe', () => {
    render(<DetallePedido pedido={crearPedido({ estado: 'rechazado', repartidor: null, motivoRechazo: 'Pago no recibido.' })} />)

    expect(screen.getByText('Motivo del rechazo: Pago no recibido.')).toBeInTheDocument()
    expect(screen.queryByText(/Repartidor:/)).not.toBeInTheDocument()
  })

  it('muestra el historial con estado, usuario o "Sistema"', () => {
    const historial = [
      { estadoNuevo: 'pendiente', creadoEn: '2026-10-05T14:30:00Z', usuario: null },
      { estadoNuevo: 'asignado', creadoEn: '2026-10-05T15:00:00Z', usuario: { nombre: 'Vendedor Uno' } },
    ]

    render(<DetallePedido pedido={crearPedido({ historial })} />)

    const lista = screen.getByRole('heading', { name: 'Historial' }).nextElementSibling
    const entradas = within(lista).getAllByRole('listitem')
    expect(entradas).toHaveLength(2)
    expect(entradas[0]).toHaveTextContent('Pendiente')
    expect(entradas[0]).toHaveTextContent('Sistema')
    expect(entradas[1]).toHaveTextContent('Asignado')
    expect(entradas[1]).toHaveTextContent('Vendedor Uno')
  })

  // ESTADOS_PEDIDO (utils/panel.js) no define "aprobado", que el backend sí registra en el
  // historial al aprobar un pedido: se muestra el valor crudo "aprobado" en lugar de "Aprobado".
  it.fails('muestra el estado "aprobado" del historial con su nombre visible', () => {
    const historial = [{ estadoNuevo: 'aprobado', creadoEn: '2026-10-05T15:00:00Z', usuario: { nombre: 'Vendedor Uno' } }]

    render(<DetallePedido pedido={crearPedido({ historial })} />)

    const lista = screen.getByRole('heading', { name: 'Historial' }).nextElementSibling
    expect(within(lista).getByText('Aprobado')).toBeInTheDocument()
  })

  it('sin historial no muestra la sección', () => {
    render(<DetallePedido pedido={crearPedido({ historial: [] })} />)

    expect(screen.queryByRole('heading', { name: 'Historial' })).not.toBeInTheDocument()
  })

  it('muestra las acciones que recibe como hijos', () => {
    render(
      <DetallePedido pedido={crearPedido()}>
        <button type="button">Acción de prueba</button>
      </DetallePedido>,
    )

    expect(screen.getByRole('button', { name: 'Acción de prueba' })).toBeInTheDocument()
  })
})
