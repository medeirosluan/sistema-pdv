import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

const authState = vi.hoisted(() => ({
  user: {
    id: 'u1',
    name: 'Ana Proprietária',
    role: 'OWNER' as const,
    platformAdmin: false,
    permissions: ['reports.view'],
    tenant: { id: 'tenant-1', name: 'Loja Demo' },
  },
}))

const onlineState = vi.hoisted(() => ({ value: true }))

const refreshCatalogMock = vi.hoisted(() => vi.fn(async () => ({ products: 0, customers: 0 })))
const syncPendingSalesMock = vi.hoisted(() => vi.fn(async () => ({ synced: 0, failed: 0 })))
const syncPendingCashMovementsMock = vi.hoisted(() => vi.fn(async () => ({ synced: 0, failed: 0 })))
const syncPendingCashOpenMock = vi.hoisted(() => vi.fn(async () => undefined))
const syncPendingCashCloseMock = vi.hoisted(() => vi.fn(async () => undefined))
const countPendingSalesMock = vi.hoisted(() => vi.fn(async () => 0))
const countPendingCashMovementsMock = vi.hoisted(() => vi.fn(async () => 0))
const countPendingCashSessionMock = vi.hoisted(() => vi.fn(async () => 0))

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/useKiosk', () => ({
  useKiosk: () => ({ kiosk: false, toggle: vi.fn(), exit: vi.fn() }),
}))

vi.mock('../lib/offline/useOnlineStatus', () => ({
  useOnlineStatus: () => onlineState.value,
}))

vi.mock('../lib/offline/catalogCache', () => ({
  refreshCatalog: refreshCatalogMock,
}))

vi.mock('../lib/offline/salesQueue', () => ({
  countPendingSales: countPendingSalesMock,
  syncPendingSales: syncPendingSalesMock,
  onPendingChanged: () => () => undefined,
}))

vi.mock('../lib/offline/cashQueue', () => ({
  countPendingCashMovements: countPendingCashMovementsMock,
  syncPendingCashMovements: syncPendingCashMovementsMock,
  countPendingCashSession: countPendingCashSessionMock,
  syncPendingCashOpen: syncPendingCashOpenMock,
  syncPendingCashClose: syncPendingCashCloseMock,
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="painel" element={<div>Conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout — fluxo offline', () => {
  beforeEach(() => {
    onlineState.value = true
    refreshCatalogMock.mockClear()
    syncPendingSalesMock.mockClear()
    syncPendingCashMovementsMock.mockClear()
    syncPendingCashOpenMock.mockClear().mockResolvedValue(undefined)
    syncPendingCashCloseMock.mockClear().mockResolvedValue(undefined)
    countPendingSalesMock.mockReset().mockResolvedValue(0)
    countPendingCashMovementsMock.mockReset().mockResolvedValue(0)
    countPendingCashSessionMock.mockReset().mockResolvedValue(0)
  })

  it('não mostra o indicador de offline quando está online', async () => {
    renderLayout()
    await screen.findByText('Conteúdo')

    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })

  it('mostra o indicador de offline quando está sem conexão', async () => {
    onlineState.value = false
    renderLayout()

    expect(await screen.findByText('Offline')).toBeInTheDocument()
  })

  it('sincroniza catálogo e filas pendentes ao renderizar online', async () => {
    renderLayout()

    await waitFor(() => {
      expect(refreshCatalogMock).toHaveBeenCalledWith('tenant-1')
      expect(syncPendingSalesMock).toHaveBeenCalledWith('tenant-1')
      expect(syncPendingCashMovementsMock).toHaveBeenCalledWith('tenant-1')
      expect(syncPendingCashOpenMock).toHaveBeenCalledWith('tenant-1')
      expect(syncPendingCashCloseMock).toHaveBeenCalledWith('tenant-1')
    })
  })

  it('sincroniza a abertura do caixa antes das vendas/movimentos e o fechamento por último', async () => {
    const order: string[] = []
    syncPendingCashOpenMock.mockImplementation(async () => {
      order.push('open')
    })
    syncPendingSalesMock.mockImplementation(async () => {
      order.push('sales')
      return { synced: 0, failed: 0 }
    })
    syncPendingCashMovementsMock.mockImplementation(async () => {
      order.push('movements')
      return { synced: 0, failed: 0 }
    })
    syncPendingCashCloseMock.mockImplementation(async () => {
      order.push('close')
    })
    renderLayout()

    await waitFor(() => expect(syncPendingCashCloseMock).toHaveBeenCalled())

    expect(order[0]).toBe('open')
    expect(order[order.length - 1]).toBe('close')
  })

  it('não sincroniza quando está offline', async () => {
    onlineState.value = false
    renderLayout()
    await screen.findByText('Offline')

    expect(refreshCatalogMock).not.toHaveBeenCalled()
    expect(syncPendingSalesMock).not.toHaveBeenCalled()
  })

  it('mostra a contagem de itens pendentes (vendas + movimentos de caixa)', async () => {
    countPendingSalesMock.mockResolvedValue(2)
    countPendingCashMovementsMock.mockResolvedValue(1)
    renderLayout()

    expect(await screen.findByText('3 pendente(s)')).toBeInTheDocument()
  })

  it('não mostra o indicador de pendências quando não há nada na fila', async () => {
    renderLayout()
    await screen.findByText('Conteúdo')

    expect(screen.queryByText(/pendente\(s\)/)).not.toBeInTheDocument()
  })

  describe('retentativa periódica e sincronização manual', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('tenta sincronizar novamente depois de um tempo, mesmo sem o evento online', async () => {
      renderLayout()
      await waitFor(() => expect(syncPendingSalesMock).toHaveBeenCalledTimes(1))

      await vi.advanceTimersByTimeAsync(120_000)

      await waitFor(() => expect(syncPendingSalesMock).toHaveBeenCalledTimes(2))
      expect(refreshCatalogMock).toHaveBeenCalledTimes(2)
      expect(syncPendingCashMovementsMock).toHaveBeenCalledTimes(2)
    })

    it('permite forçar a sincronização pelo botão ao lado da contagem de pendências', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      countPendingSalesMock.mockResolvedValue(1)
      renderLayout()
      await screen.findByText('1 pendente(s)')
      await waitFor(() => expect(syncPendingSalesMock).toHaveBeenCalledTimes(1))

      await user.click(screen.getByTitle('Sincronizar agora'))

      await waitFor(() => expect(syncPendingSalesMock).toHaveBeenCalledTimes(2))
    })
  })
})
