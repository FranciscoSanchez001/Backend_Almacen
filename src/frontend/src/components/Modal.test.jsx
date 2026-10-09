import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

const renderizarModal = (props = {}) => {
  const alCerrar = vi.fn()
  const resultado = render(
    <Modal abierto titulo="Reponer stock" alCerrar={alCerrar} {...props}>
      <p>Contenido del modal</p>
    </Modal>,
  )
  return { ...resultado, alCerrar }
}

describe('Modal', () => {
  it('cerrado no muestra nada', () => {
    renderizarModal({ abierto: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abierto muestra un diálogo con su título como nombre accesible y el contenido', () => {
    renderizarModal()

    const dialogo = screen.getByRole('dialog', { name: 'Reponer stock' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Contenido del modal')).toBeInTheDocument()
  })

  it('bloquea el desplazamiento de la página mientras está abierto', () => {
    const { unmount } = renderizarModal()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })

  it('se cierra con el botón Cerrar', async () => {
    const { alCerrar } = renderizarModal()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(alCerrar).toHaveBeenCalledOnce()
  })

  it('se cierra con la tecla Escape', async () => {
    const { alCerrar } = renderizarModal()

    await userEvent.keyboard('{Escape}')

    expect(alCerrar).toHaveBeenCalledOnce()
  })

  it('se cierra al tocar el fondo, pero no al tocar el contenido', async () => {
    const { alCerrar, container } = renderizarModal()

    await userEvent.click(screen.getByText('Contenido del modal'))
    expect(alCerrar).not.toHaveBeenCalled()

    await userEvent.click(container.querySelector('.bg-black\\/50'))
    expect(alCerrar).toHaveBeenCalledOnce()
  })

  it('cerrado no reacciona a Escape', async () => {
    const { alCerrar } = renderizarModal({ abierto: false })

    await userEvent.keyboard('{Escape}')

    expect(alCerrar).not.toHaveBeenCalled()
  })
})
