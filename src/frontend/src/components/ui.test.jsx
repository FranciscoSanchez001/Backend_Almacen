import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga, EtiquetaEstado, Paginacion, Selector } from './ui'

describe('EncabezadoPagina', () => {
  it('muestra título, detalle y acciones', () => {
    render(
      <EncabezadoPagina titulo="Pedidos" detalle="Bandeja de revisión">
        <button>Actualizar</button>
      </EncabezadoPagina>,
    )

    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Bandeja de revisión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument()
  })

  it('sin detalle ni acciones muestra solo el título', () => {
    const { container } = render(<EncabezadoPagina titulo="Inventario" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('EstadoCarga', () => {
  it('mientras carga muestra "Cargando…" y no el contenido', () => {
    render(<EstadoCarga cargando>Datos</EstadoCarga>)

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Datos')).not.toBeInTheDocument()
  })

  it('con error muestra el mensaje y permite reintentar', async () => {
    const alReintentar = vi.fn()
    render(
      <EstadoCarga error="No se pudo conectar" alReintentar={alReintentar}>
        Datos
      </EstadoCarga>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(screen.getByText('No se pudo conectar')).toBeInTheDocument()
    expect(alReintentar).toHaveBeenCalledOnce()
  })

  it('con error y sin reintento no muestra el botón', () => {
    render(<EstadoCarga error="Falló">Datos</EstadoCarga>)

    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('vacío muestra el texto indicado o uno por defecto', () => {
    const { rerender } = render(<EstadoCarga vacio textoVacio="No hay pedidos pendientes.">Datos</EstadoCarga>)
    expect(screen.getByText('No hay pedidos pendientes.')).toBeInTheDocument()

    rerender(<EstadoCarga vacio>Datos</EstadoCarga>)

    expect(screen.getByText('No hay nada que mostrar.')).toBeInTheDocument()
  })

  it('sin carga, error ni vacío muestra el contenido', () => {
    render(<EstadoCarga>Datos</EstadoCarga>)

    expect(screen.getByText('Datos')).toBeInTheDocument()
  })
})

describe('Aviso', () => {
  it('sin aviso no muestra nada', () => {
    const { container } = render(<Aviso aviso={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el texto en una región de estado, en verde si es correcto y en rojo si es error', () => {
    const { rerender } = render(<Aviso aviso={{ tipo: 'ok', texto: 'Producto guardado.' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Producto guardado.')
    expect(screen.getByRole('status')).toHaveClass('text-emerald-800')

    rerender(<Aviso aviso={{ tipo: 'error', texto: 'No se pudo guardar.' }} />)

    expect(screen.getByRole('status')).toHaveTextContent('No se pudo guardar.')
    expect(screen.getByRole('status')).toHaveClass('text-red-700')
  })
})

describe('Selector', () => {
  const opciones = [
    ['pendiente', 'Pendientes'],
    ['entregado', 'Entregados'],
  ]

  it('marca como pulsada la opción elegida dentro de un grupo con etiqueta', () => {
    render(<Selector etiqueta="Estado" opciones={opciones} valor="pendiente" alCambiar={() => {}} />)

    expect(screen.getByRole('group', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Entregados' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('avisa el valor de la opción pulsada', async () => {
    const alCambiar = vi.fn()
    render(<Selector etiqueta="Estado" opciones={opciones} valor="pendiente" alCambiar={alCambiar} />)

    await userEvent.click(screen.getByRole('button', { name: 'Entregados' }))

    expect(alCambiar).toHaveBeenCalledWith('entregado')
  })
})

describe('Paginacion', () => {
  it('con una sola página no se muestra', () => {
    const { container } = render(<Paginacion pagina={1} total={10} tamano={20} alCambiar={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('muestra la página actual y el total de páginas', () => {
    render(<Paginacion pagina={2} total={45} tamano={20} alCambiar={() => {}} />)

    expect(screen.getByRole('navigation', { name: 'Páginas' })).toHaveTextContent('Página 2 de 3')
  })

  it('en la primera página deshabilita "Anterior" y avanza con "Siguiente"', async () => {
    const alCambiar = vi.fn()
    render(<Paginacion pagina={1} total={45} tamano={20} alCambiar={alCambiar} />)

    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }))

    expect(alCambiar).toHaveBeenCalledWith(2)
  })

  it('en la última página deshabilita "Siguiente" y retrocede con "Anterior"', async () => {
    const alCambiar = vi.fn()
    render(<Paginacion pagina={3} total={45} tamano={20} alCambiar={alCambiar} />)

    expect(screen.getByRole('button', { name: 'Siguiente →' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '← Anterior' }))

    expect(alCambiar).toHaveBeenCalledWith(2)
  })
})

describe('EtiquetaEstado', () => {
  it('muestra el nombre legible del estado', () => {
    render(<EtiquetaEstado estado="en_camino" />)

    expect(screen.getByText('En camino')).toBeInTheDocument()
  })

  it('un estado desconocido se muestra tal cual', () => {
    render(<EtiquetaEstado estado="otro_estado" />)

    expect(screen.getByText('otro_estado')).toBeInTheDocument()
  })
})

describe('Campo', () => {
  it('asocia la etiqueta al control y muestra la ayuda', () => {
    render(
      <Campo id="nombre" etiqueta="Nombre" ayuda="Como aparecerá en la tienda">
        <input id="nombre" />
      </Campo>,
    )

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
    expect(screen.getByText('Como aparecerá en la tienda')).toBeInTheDocument()
  })

  it('con error muestra el error en lugar de la ayuda', () => {
    render(
      <Campo id="precio" etiqueta="Precio" ayuda="En USD" error="El precio debe ser mayor que 0.">
        <input id="precio" />
      </Campo>,
    )

    expect(screen.getByText('El precio debe ser mayor que 0.')).toBeInTheDocument()
    expect(screen.queryByText('En USD')).not.toBeInTheDocument()
  })
})
