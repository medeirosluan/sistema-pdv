import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { CloseResult, CurrentCashRegister } from '../lib/cash'
import { CashRegister } from './CashRegister'

const authState = vi.hoisted(() => ({
  user: { tenant: { id: 'tenant-1' } },
}))

const cashCurrentMock = vi.hoisted(() => vi.fn())
const cashOpenMock = vi.hoisted(() => vi.fn())
const cashCloseMock = vi.hoisted(() => vi.fn())
const cashAddMovementMock = vi.hoisted(() => vi.fn())
const cashHistoryMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('../components/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('../lib/cash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/cash')>()
  return {
    ...actual,
    cashApi: {
      ...actual.cashApi,
      current: cashCurrentMock,
      open: cashOpenMock,
      close: cashCloseMock,
      addMovement: cashAddMovementMock,
      history: cashHistoryMock,
    },
  }
})

vi.mock('../lib/offline/cashQueue', () => ({
  addPendingCashMovement: vi.fn(),
  listPendingCashMovements: vi.fn(async () => []),
}))

vi.mock('../lib/offline/db', () => ({
  getMeta: vi.fn(async () => undefined),
  setMeta: vi.fn(async () => undefined),
}))

function openRegister(
  overrides: Partial<CurrentCashRegister> = {},
): CurrentCashRegister {
  return {
    register: {
      id: 'reg-1',
      status: 'OPEN',
      openingAmount: 100,
      closingAmount: null,
      openedAt: '2026-01-15T08:00:00Z',
      closedAt: null,
      openedBy: { id: 'user-1', name: 'Ana' },
      movements: [],
    },
    summary: {
      salesCount: 2,
      salesTotal: 150,
      byMethod: { CASH: 150, PIX: 0, CREDIT: 0, DEBIT: 0 },
      deposits: 0,
      withdrawals: 0,
      expectedCash: 250,
    },
    ...overrides,
  }
}

describe('CashRegister', () => {
  beforeEach(() => {
    authState.user = { tenant: { id: 'tenant-1' } }
    cashCurrentMock.mockReset()
    cashOpenMock.mockReset()
    cashCloseMock.mockReset()
    cashAddMovementMock.mockReset()
    cashHistoryMock.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
  })

  it('mostra o formulário de abertura quando não há caixa aberto', async () => {
    cashCurrentMock.mockResolvedValue(null)
    render(<CashRegister />)

    expect(await screen.findByText('Caixa fechado')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Valor de abertura'),
    ).toBeInTheDocument()
  })

  it('abre o caixa ao submeter o valor inicial', async () => {
    const user = userEvent.setup()
    cashCurrentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(openRegister())
    cashOpenMock.mockResolvedValue({})
    render(<CashRegister />)
    await screen.findByText('Caixa fechado')

    await user.type(screen.getByPlaceholderText('Valor de abertura'), '100')
    await user.click(screen.getByRole('button', { name: 'Abrir caixa' }))

    await waitFor(() => {
      expect(cashOpenMock).toHaveBeenCalledWith(100)
    })
    expect(await screen.findByText('Caixa aberto')).toBeInTheDocument()
  })

  it('exibe o resumo do caixa aberto', async () => {
    cashCurrentMock.mockResolvedValue(openRegister())
    render(<CashRegister />)

    expect(await screen.findByText('Caixa aberto')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 250,00').length).toBeGreaterThan(0) // dinheiro na gaveta / valor esperado
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument() // vendas no turno
    expect(screen.getByText('2 venda(s)')).toBeInTheDocument()
  })

  it('registra uma sangria e recarrega o resumo', async () => {
    const user = userEvent.setup()
    cashCurrentMock.mockResolvedValue(openRegister())
    cashAddMovementMock.mockResolvedValue({})
    render(<CashRegister />)
    await screen.findByText('Caixa aberto')

    await user.click(screen.getByRole('button', { name: /Sangria/ }))
    await user.type(screen.getByPlaceholderText('Valor'), '50')
    await user.type(screen.getByPlaceholderText('Motivo (opcional)'), 'Troco')
    await user.click(screen.getByRole('button', { name: 'Registrar movimento' }))

    await waitFor(() => {
      expect(cashAddMovementMock).toHaveBeenCalledWith({
        type: 'WITHDRAWAL',
        amount: 50,
        reason: 'Troco',
      })
    })
  })

  it('mostra a diferença ao digitar o valor de fechamento', async () => {
    const user = userEvent.setup()
    cashCurrentMock.mockResolvedValue(openRegister())
    render(<CashRegister />)
    await screen.findByText('Caixa aberto')

    await user.type(screen.getByPlaceholderText('Valor contado'), '240')

    expect(screen.getByText('Diferença')).toBeInTheDocument()
    expect(screen.getByText('-R$ 10,00')).toBeInTheDocument()
  })

  it('fecha o caixa após confirmação e mostra o resultado', async () => {
    const user = userEvent.setup()
    const closeResult: CloseResult = {
      register: { ...openRegister().register, closingAmount: 250 },
      summary: openRegister().summary,
      difference: 0,
    }
    cashCurrentMock
      .mockResolvedValueOnce(openRegister())
      .mockResolvedValueOnce(null)
    cashCloseMock.mockResolvedValue(closeResult)
    render(<CashRegister />)
    await screen.findByText('Caixa aberto')

    await user.type(screen.getByPlaceholderText('Valor contado'), '250')
    await user.click(screen.getByRole('button', { name: 'Fechar caixa' }))

    await waitFor(() => {
      expect(cashCloseMock).toHaveBeenCalledWith(250)
    })
    expect(
      await screen.findByRole('button', { name: 'Fechar aviso' }),
    ).toBeInTheDocument()
    expect(toastMock.success).toHaveBeenCalledWith('Caixa fechado.')
  })

  it('não fecha o caixa quando a confirmação é cancelada', async () => {
    const user = userEvent.setup()
    confirmMock.mockResolvedValue(false)
    cashCurrentMock.mockResolvedValue(openRegister())
    render(<CashRegister />)
    await screen.findByText('Caixa aberto')

    await user.type(screen.getByPlaceholderText('Valor contado'), '250')
    await user.click(screen.getByRole('button', { name: 'Fechar caixa' }))

    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(cashCloseMock).not.toHaveBeenCalled()
  })

  it('exibe a mensagem de erro da API quando o carregamento do caixa falha', async () => {
    cashCurrentMock.mockRejectedValue(new ApiError(500, 'Erro ao carregar o caixa'))
    render(<CashRegister />)

    expect(
      await screen.findByText('Erro ao carregar o caixa'),
    ).toBeInTheDocument()
  })

  it('lista o histórico de caixas ou a mensagem de vazio', async () => {
    cashCurrentMock.mockResolvedValue(null)
    cashHistoryMock.mockResolvedValue({
      items: [
        {
          id: 'reg-old',
          status: 'CLOSED',
          openingAmount: 100,
          closingAmount: 300,
          openedAt: '2026-01-14T08:00:00Z',
          closedAt: '2026-01-14T18:00:00Z',
          openedBy: { id: 'user-1', name: 'Ana' },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    render(<CashRegister />)

    expect(await screen.findByText('Fechado')).toBeInTheDocument()
  })
})
