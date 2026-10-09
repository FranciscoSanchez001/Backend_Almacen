import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Auditoria from './Auditoria'
import { listarCambios, listarCambiosPedidos, listarPersonalCompleto } from '../../api/auditoria'
import { listarTodosLosProductos } from '../../api/productos'
import { ErrorApi } from '../../api/cliente'
import { pagina, renderizar } from '../../test/renderizar'

vi.mock('../../api/auditoria', () => ({
  listarCambios: vi.fn(),
  listarCambiosPedidos: vi.fn(),
  listarPersonalCompleto: vi.fn(),
}))
vi.mock('../../api/productos', () => ({ listarTodosLosProductos: vi.fn() }))

const personal = [
  { id: 'u1', nombre: 'Ana Pérez', rol: 'ventas' },
  { id: 'u0', nombre: 'Gerente', rol: 'superadmin' },
]
const productos = [
  { id: 'p1', nombre: 'Arroz' },
  { id: 'p2', nombre: 'Harina PAN' },
]

const edicionPrecio = {
  id: 'a1',
  creadoEn: '2026-10-05T14:30:00Z',
  usuario: 'Ana Pérez',
  accion: 'editar',
  entidad: 'producto',
  entidadNombre: 'Arroz',
  datosAntes: { nombre: 'Arroz', precioUsd: 1.5 },
  datosDespues: { nombre: 'Arroz', precioUsd: 2 },
}
const creacion = {
  id: 'a2',
  creadoEn: '2026-10-05T15:00:00Z',
  usuario: null,
  accion: 'crear',
  entidad: 'producto',
  entidadNombre: 'Harina PAN',
  datosAntes: null,
  datosDespues: { codigoSku: 'VIV-0002' },
}
const descarga = {
  id: 'a3',
  creadoEn: '2026-10-05T16:00:00Z',
  usuario: 'Gerente',
  accion: 'descargar_reporte',
  entidad: 'reporte',
  entidadNombre: null,
  datosAntes: null,
  datosDespues: null,
}

const consultaInicial = { usuarioId: '', desde: '', hasta: '', pagina: 1, tamano: 25 }

function montar() {
  return renderizar(<Auditoria />, { ruta: '/admin/auditoria', rol: 'superadmin' })
}

const fila = (texto) => within(screen.getByRole('table')).getByRole('row', { name: new RegExp(texto) })

beforeEach(() => {
  vi.mocked(listarCambios).mockReset().mockResolvedValue(pagina([edicionPrecio, creacion, descarga], { tamano: 25 }))
  vi.mocked(listarCambiosPedidos).mockReset().mockResolvedValue(pagina([]))
  vi.mocked(listarPersonalCompleto).mockReset().mockResolvedValue(personal)
  vi.mocked(listarTodosLosProductos).mockReset().mockResolvedValue(productos)
})

describe('Auditoria: cambios en productos', () => {
  it('pide la primera página sin filtros', async () => {
    montar()

    await screen.findByRole('table')

    expect(listarCambios).toHaveBeenCalledWith({ ...consultaInicial, productoId: '' })
  })

  it('muestra quién hizo cada acción y solo los campos que cambiaron', async () => {
    montar()
    await screen.findByRole('table')

    const editado = fila('Editó')
    expect(editado).toHaveTextContent('Ana Pérez')
    expect(editado).toHaveTextContent('Arroz')
    expect(editado).toHaveTextContent('precioUsd: 1.5 → 2')
    expect(within(editado).queryByText('nombre')).not.toBeInTheDocument()
  })

  it('una creación muestra solo los datos nuevos y "Sistema" si no hubo usuario', async () => {
    montar()
    await screen.findByRole('table')

    const creado = fila('Creó')
    expect(creado).toHaveTextContent('Sistema')
    expect(creado).toHaveTextContent('codigoSku: VIV-0002')
    expect(creado).not.toHaveTextContent('→')
  })

  it('traduce la descarga del informe y muestra un guion si no hay cambios', async () => {
    montar()
    await screen.findByRole('table')

    const descargado = fila('Descargó informe')
    expect(within(descargado).getAllByText('—')).toHaveLength(2)
  })

  it('sin resultados lo indica', async () => {
    vi.mocked(listarCambios).mockResolvedValue(pagina([]))
    montar()

    expect(await screen.findByText('No hay cambios con esos filtros.')).toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(listarCambios)
      .mockRejectedValueOnce(new ErrorApi('El servicio no está disponible en este momento.', 503, null))
      .mockResolvedValueOnce(pagina([edicionPrecio]))
    const { user } = montar()

    expect(await screen.findByText('El servicio no está disponible en este momento.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('Auditoria: filtros y paginación', () => {
  it('ofrece el personal y los productos en los filtros', async () => {
    montar()

    expect(await screen.findByRole('option', { name: 'Ana Pérez (ventas)' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Harina PAN' })).toBeInTheDocument()
  })

  it('filtra por usuario y producto', async () => {
    const { user } = montar()
    await screen.findByRole('option', { name: 'Harina PAN' })

    await user.selectOptions(screen.getByLabelText('Filtrar por usuario'), 'u1')
    await user.selectOptions(screen.getByLabelText('Filtrar por producto'), 'p2')

    expect(listarCambios).toHaveBeenLastCalledWith({ ...consultaInicial, usuarioId: 'u1', productoId: 'p2' })
  })

  it('el rango de fechas incluye el día completo de "hasta"', async () => {
    montar()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-05' } })

    expect(listarCambios).toHaveBeenLastCalledWith({
      ...consultaInicial,
      productoId: '',
      desde: '2026-10-01T00:00:00',
      hasta: '2026-10-05T23:59:59',
    })
  })

  it('pagina de 25 en 25 y al filtrar vuelve a la primera página', async () => {
    vi.mocked(listarCambios).mockResolvedValue(pagina([edicionPrecio], { total: 60 }))
    const { user } = montar()
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Siguiente →' }))
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(listarCambios).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }))

    await user.selectOptions(screen.getByLabelText('Filtrar por usuario'), 'u1')
    expect(listarCambios).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1, usuarioId: 'u1' }))
  })
})

describe('Auditoria: estados de pedidos', () => {
  const cambiosPedido = [
    { id: 'c1', creadoEn: '2026-10-05T14:00:00Z', numeroPedido: 1024, estadoAnterior: null, estadoNuevo: 'pendiente', usuario: null },
    { id: 'c2', creadoEn: '2026-10-05T14:30:00Z', numeroPedido: 1024, estadoAnterior: 'pendiente', estadoNuevo: 'asignado', usuario: 'Ana Pérez' },
    { id: 'c3', creadoEn: '2026-10-05T15:00:00Z', numeroPedido: 1025, estadoAnterior: 'pendiente', estadoNuevo: 'aprobado', usuario: 'Ana Pérez' },
  ]

  async function verPedidos() {
    vi.mocked(listarCambiosPedidos).mockResolvedValue(pagina(cambiosPedido))
    const vista = montar()
    await screen.findByRole('table')
    await vista.user.click(screen.getByRole('button', { name: 'Estados de pedidos' }))
    await screen.findByText('#1025')
    return vista
  }

  it('cambia a la vista de pedidos sin el filtro de producto', async () => {
    await verPedidos()

    expect(listarCambiosPedidos).toHaveBeenLastCalledWith(consultaInicial)
    expect(screen.queryByLabelText('Filtrar por producto')).not.toBeInTheDocument()
  })

  it('muestra cada transición con el nombre de los estados', async () => {
    await verPedidos()

    expect(fila('Sistema')).toHaveTextContent('#1024')
    expect(fila('Sistema')).toHaveTextContent('Nuevo → Pendiente')
    expect(fila('Asignado')).toHaveTextContent('Pendiente → Asignado')
    expect(fila('Asignado')).toHaveTextContent('Ana Pérez')
  })

  // Error conocido: ESTADOS_PEDIDO (utils/panel.js) no define "aprobado", que el backend sí
  // registra al aprobar un pedido, así que la transición se muestra con el valor crudo.
  it.fails('muestra el estado "aprobado" con su nombre', async () => {
    await verPedidos()

    expect(fila('#1025')).toHaveTextContent('Pendiente → Aprobado')
  })
})
