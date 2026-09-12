import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'

const isTauriMock = vi.hoisted(() => vi.fn(() => false))
const checkForUpdateMock = vi.hoisted(() => vi.fn())
const installUpdateAndRestartMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/tauri', () => ({
  isTauri: isTauriMock,
  checkForUpdate: checkForUpdateMock,
  installUpdateAndRestart: installUpdateAndRestartMock,
}))

describe('UpdateBanner', () => {
  beforeEach(() => {
    isTauriMock.mockReset().mockReturnValue(false)
    checkForUpdateMock.mockReset()
    installUpdateAndRestartMock.mockReset()
  })

  it('não verifica nem mostra nada fora do app desktop', () => {
    render(<UpdateBanner />)
    expect(checkForUpdateMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/Nova versão disponível/)).not.toBeInTheDocument()
  })

  it('não mostra nada quando não há atualização', async () => {
    isTauriMock.mockReturnValue(true)
    checkForUpdateMock.mockResolvedValue(null)
    render(<UpdateBanner />)

    await waitFor(() => expect(checkForUpdateMock).toHaveBeenCalled())
    expect(screen.queryByText(/Nova versão disponível/)).not.toBeInTheDocument()
  })

  it('mostra o aviso quando há uma atualização disponível', async () => {
    isTauriMock.mockReturnValue(true)
    checkForUpdateMock.mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
    })
    render(<UpdateBanner />)

    expect(
      await screen.findByText('Nova versão disponível (0.2.0)'),
    ).toBeInTheDocument()
  })

  it('instala e reinicia ao clicar em "Atualizar agora"', async () => {
    const user = userEvent.setup()
    isTauriMock.mockReturnValue(true)
    checkForUpdateMock.mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
    })
    installUpdateAndRestartMock.mockResolvedValue(undefined)
    render(<UpdateBanner />)
    await screen.findByText('Nova versão disponível (0.2.0)')

    await user.click(screen.getByRole('button', { name: 'Atualizar agora' }))

    await waitFor(() => {
      expect(installUpdateAndRestartMock).toHaveBeenCalled()
    })
  })

  it('mostra o erro quando a instalação falha', async () => {
    const user = userEvent.setup()
    isTauriMock.mockReturnValue(true)
    checkForUpdateMock.mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
    })
    installUpdateAndRestartMock.mockRejectedValue(new Error('Falha ao baixar'))
    render(<UpdateBanner />)
    await screen.findByText('Nova versão disponível (0.2.0)')

    await user.click(screen.getByRole('button', { name: 'Atualizar agora' }))

    expect(await screen.findByText('Falha ao baixar')).toBeInTheDocument()
  })

  it('some ao clicar em dispensar e não aparece de novo', async () => {
    const user = userEvent.setup()
    isTauriMock.mockReturnValue(true)
    checkForUpdateMock.mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
    })
    render(<UpdateBanner />)
    await screen.findByText('Nova versão disponível (0.2.0)')

    await user.click(screen.getByTitle('Depois'))

    expect(screen.queryByText(/Nova versão disponível/)).not.toBeInTheDocument()
  })
})
