import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('não renderiza nada quando open é false', () => {
    const { container } = render(
      <Modal open={false} title="Teste" onClose={vi.fn()}>
        Conteúdo
      </Modal>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza título, conteúdo e rodapé quando open é true', () => {
    render(
      <Modal
        open
        title="Meu modal"
        onClose={vi.fn()}
        footer={<button type="button">Salvar</button>}
      >
        Conteúdo do modal
      </Modal>,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Meu modal')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('chama onClose ao pressionar Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="Teste" onClose={onClose}>
        Conteúdo
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chama onClose ao clicar no fundo, mas não ao clicar no painel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open title="Teste" onClose={onClose}>
        Conteúdo
      </Modal>,
    )

    await user.click(screen.getByText('Conteúdo'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chama onClose ao clicar no botão de fechar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open title="Teste" onClose={onClose}>
        Conteúdo
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
