import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarrasHorizontales, Dona, GraficoLinea, MapaCalor, TarjetaGrafico, TarjetaKpi } from './Graficos'
import { renderizar } from '../../test/renderizar'

// Los gráficos usan el tema (colores claros u oscuros), así que se renderizan con los proveedores.
const montar = (ui) => renderizar(ui, { ruta: '/admin' })

describe('TarjetaKpi', () => {
  it('muestra título, valor y detalle', () => {
    montar(<TarjetaKpi titulo="Ventas" valor="$1,234.50" detalle="Bs 45.000,00" />)

    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('$1,234.50')).toBeInTheDocument()
    expect(screen.getByText('Bs 45.000,00')).toBeInTheDocument()
  })

  it.each([
    [12.5, '↑ 12,5 %'],
    [-4, '↓ 4 %'],
    [0, '= 0 %'],
  ])('con crecimiento %d muestra "%s"', (crecimiento, texto) => {
    montar(<TarjetaKpi titulo="Pedidos" valor="42" crecimiento={crecimiento} />)

    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('sin crecimiento no muestra comparación', () => {
    montar(<TarjetaKpi titulo="Unidades por pedido" valor="2,86" />)

    expect(screen.queryByText(/[↑↓=] /)).not.toBeInTheDocument()
  })

  it('resalta el valor cuando es una alerta', () => {
    montar(<TarjetaKpi titulo="Expirados" valor="10 %" alerta />)

    expect(screen.getByText('10 %')).toHaveClass('text-red-700')
  })
})

describe('TarjetaGrafico', () => {
  it('muestra el gráfico y una tabla con los mismos datos', () => {
    montar(
      <TarjetaGrafico
        titulo="Ventas por zona (USD)"
        detalle="Según la zona de entrega."
        tabla={{ columnas: ['Zona', 'Pedidos'], filas: [['Centro', 12], ['Pueblo Nuevo', 7]] }}
      >
        <p>contenido del gráfico</p>
      </TarjetaGrafico>,
    )

    expect(screen.getByRole('heading', { name: 'Ventas por zona (USD)' })).toBeInTheDocument()
    expect(screen.getByText('Según la zona de entrega.')).toBeInTheDocument()
    expect(screen.getByText('contenido del gráfico')).toBeInTheDocument()
    expect(screen.getByText('Ver datos en tabla')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { hidden: true })
    expect(within(tabla).getAllByRole('columnheader', { hidden: true }).map((c) => c.textContent)).toEqual(['Zona', 'Pedidos'])
    expect(within(tabla).getAllByRole('row', { hidden: true })).toHaveLength(3)
  })

  it('sin filas no ofrece la tabla', () => {
    montar(
      <TarjetaGrafico titulo="Entregas por repartidor" tabla={{ columnas: ['Repartidor'], filas: [] }}>
        <p>vacío</p>
      </TarjetaGrafico>,
    )

    expect(screen.queryByText('Ver datos en tabla')).not.toBeInTheDocument()
  })
})

describe('MapaCalor', () => {
  const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const matriz = dias.map((_, d) => Array.from({ length: 24 }, (_, h) => (d === 0 && h === 10 ? 4 : d === 4 && h === 18 ? 1 : 0)))

  it('tiene una celda por día y hora, con la cantidad de pedidos accesible', () => {
    const { container } = montar(<MapaCalor matriz={matriz} dias={dias} />)

    expect(container.querySelectorAll('[aria-label$="pedidos"]')).toHaveLength(7 * 24)
    expect(screen.getByLabelText('lunes 10:00, 4 pedidos')).toHaveAttribute('title', 'lunes 10:00 – 4 pedidos')
    expect(screen.getByLabelText('viernes 18:00, 1 pedidos')).toHaveAttribute('title', 'viernes 18:00 – 1 pedido')
    expect(screen.getByText('Más (máx. 4)', { exact: false })).toBeInTheDocument()
  })

  it('pinta el máximo con el tono más intenso y las celdas vacías con el color de fondo', () => {
    montar(<MapaCalor matriz={matriz} dias={dias} />)

    expect(screen.getByLabelText('lunes 10:00, 4 pedidos')).toHaveStyle({ background: '#0d366b' })
    expect(screen.getByLabelText('lunes 0:00, 0 pedidos')).toHaveStyle({ background: '#f5f5f4' })
  })

  it('en modo oscuro usa la paleta oscura', () => {
    localStorage.setItem('almacen.tema', 'oscuro')

    montar(<MapaCalor matriz={matriz} dias={dias} />)

    expect(screen.getByLabelText('lunes 10:00, 4 pedidos')).toHaveStyle({ background: '#9ec5f4' })
    expect(screen.getByLabelText('lunes 0:00, 0 pedidos')).toHaveStyle({ background: '#1e293b' })
  })

  it('sin pedidos no divide entre cero: el máximo mostrado es 1', () => {
    const vacia = dias.map(() => Array(24).fill(0))

    montar(<MapaCalor matriz={vacia} dias={dias} />)

    expect(screen.getByText('Más (máx. 1)', { exact: false })).toBeInTheDocument()
  })
})

// Recharts no dibuja en jsdom (no hay medidas de layout): se comprueba que los gráficos
// se montan sin errores, con datos y sin ellos.
describe('gráficos de Recharts', () => {
  const ventas = [
    { inicio: '2026-10-01', ventasUsd: 120 },
    { inicio: '2026-10-02', ventasUsd: 80 },
  ]

  it('GraficoLinea se monta con datos y vacío', () => {
    const { container } = montar(
      <>
        <GraficoLinea datos={ventas} x="inicio" y="ventasUsd" nombre="Ventas" />
        <GraficoLinea datos={[]} x="inicio" y="ventasUsd" nombre="Ventas" />
      </>,
    )

    expect(container.querySelectorAll('.recharts-responsive-container')).toHaveLength(2)
  })

  it('BarrasHorizontales se monta con una o varias series', () => {
    const datos = [{ categoria: 'Víveres', costo: 10, venta: 15 }]
    const { container } = montar(
      <>
        <BarrasHorizontales datos={datos} categoria="categoria" series={[{ clave: 'venta', nombre: 'Venta' }]} />
        <BarrasHorizontales
          datos={datos}
          categoria="categoria"
          series={[
            { clave: 'costo', nombre: 'A costo' },
            { clave: 'venta', nombre: 'A precio de venta' },
          ]}
        />
      </>,
    )

    expect(container.querySelectorAll('.recharts-responsive-container')).toHaveLength(2)
  })

  it('Dona se monta con las porciones de un total', () => {
    const { container } = montar(
      <Dona datos={[{ nombre: 'Pago móvil', montoUsd: 60 }, { nombre: 'Binance', montoUsd: 40 }]} clave="montoUsd" nombre="nombre" />,
    )

    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
