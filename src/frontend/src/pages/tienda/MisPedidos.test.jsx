import { screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import MisPedidos from './MisPedidos'
import { listarMisPedidos } from '../../api/pedidos'
import { renderizar } from '../../test/renderizar'

vi.mock('../../api/pedidos', () => ({ listarMisPedidos: vi.fn() }))
const pedido = { id: 'p1', numero: 123, estado: 'pendiente', totalUsd: 4, creadoEn: '2026-10-14T12:00:00Z', zona: { nombre: 'Centro' }, items: [{ productoId: 'i1', producto: 'Arroz', cantidad: 2 }] }
beforeEach(() => vi.mocked(listarMisPedidos).mockReset())

it('muestra los pedidos del cliente y consulta la siguiente página', async () => {
  vi.mocked(listarMisPedidos).mockResolvedValue({ items: [pedido], total: 21 })
  const { user } = renderizar(<MisPedidos />, { ruta: '/mis-pedidos', rol: 'cliente' })
  expect(await screen.findByRole('heading', { name: 'Pedido #123' })).toBeInTheDocument()
  expect(screen.getByText('Pendiente')).toBeInTheDocument()
  expect(screen.getByText('2 × Arroz')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Siguiente/ }))
  expect(listarMisPedidos).toHaveBeenLastCalledWith({ pagina: 2 })
})

it('permite actualizar después de un error', async () => {
  vi.mocked(listarMisPedidos).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ items: [], total: 0 })
  const { user } = renderizar(<MisPedidos />, { ruta: '/mis-pedidos', rol: 'cliente' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  await user.click(screen.getByRole('button', { name: 'Actualizar' }))
  expect(await screen.findByText('Aún no tienes pedidos.')).toBeInTheDocument()
})
