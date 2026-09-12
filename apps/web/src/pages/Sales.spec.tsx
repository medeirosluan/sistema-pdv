import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sale } from '../lib/sales'
import { Sales } from './Sales'

const authState = vi.hoisted(() => ({
  user: {
    tenant: {
      name: 'Loja Demo',
      document: null,
      address: null,
      settings: {},
    },
  },
}))

const permissionsState = vi.hoisted(() => ({
  granted: new Set<string>(['sales.cancel']),
}))

const salesListMock = vi.hoisted(() => vi.fn())
const salesCancelMock = vi.hoisted(() => vi.fn())
const printReceiptMock = vi.hoisted(() => vi.fn())
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

vi.mock('../lib/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/permissions')>()
  return {
    ...actual,
    useCan: () => (permission: string) => permissionsState.granted.has(permission),
  }
})

vi.mock('../components/ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('../components/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('../lib/sales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sales')>()
  return {
    ...actual,
    salesApi: { ...actual.salesApi, list: salesListMock, cancel: salesCancelMock },
  }
})

vi.mock('../lib/receipt', () => ({
  printReceipt: printReceiptMock,
}))

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    number: 42,
    status: 'FINISHED',
    subtotal: 100,
    discount: 0,
    total: 100,
    customer: { id: 'c1', name: 'João' },
    createdBy: { id: 'u1', name: 'Operador' },
    items: [
      {
        id: 'i1',
        productId: 'p1',
        description: 'Arroz 5kg',
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        total: 100,
      },
    ],
    payments: [{ id: 'pay1', method: 'CASH', amount: 100, installments: 1 }],
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function paginated(items: Sale[], overrides: Partial<{ total: number; totalPages: number }> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: 1,
    pageSize: 10,
    totalPages: overrides.totalPages ?? 1,
  }
}

describe('Sales', () => {
  beforeEach(() => {
    permissionsState.granted = new Set(['sales.cancel'])
    salesListMock.mockReset().mockResolvedValue(paginated([makeSale()]))
    salesCancelMock.mockReset().mockResolvedValue(makeSale({ status: 'CANCELED' }))
    printReceiptMock.mockReset()
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('lista as vendas com status traduzido', async () => {
    render(<Sales />)

    expect(await screen.findByText('#42')).toBeInTheDocument()
    expect(screen.getByText('Finalizada')).toBeInTheDocument()
    expect(screen.getByText('João')).toBeInTheDocument()
  })

  it('filtra por situação', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await screen.findByText('#42')

    await user.selectOptions(screen.getByRole('combobox'), 'CANCELED')

    await waitFor(() => {
      expect(salesListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'CANCELED', page: 1 }),
      )
    })
  })

  it('abre o detalhe da venda ao clicar no ícone de olho', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('Arroz 5kg')).toBeInTheDocument()
  })

  it('não mostra o botão de cancelar quando falta a permissão sales.cancel', async () => {
    permissionsState.granted = new Set([])
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('button')).toHaveLength(1)
  })

  it('não mostra o botão de cancelar para vendas já canceladas', async () => {
    salesListMock.mockResolvedValue(paginated([makeSale({ status: 'CANCELED' })]))
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('button')).toHaveLength(1)
  })

  it('cancela a venda após confirmação', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[1])

    await waitFor(() => {
      expect(salesCancelMock).toHaveBeenCalledWith('s1')
    })
    expect(toastMock.success).toHaveBeenCalledWith('Venda cancelada.')
  })

  it('não cancela quando a confirmação é recusada', async () => {
    const user = userEvent.setup()
    confirmMock.mockResolvedValue(false)
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[1])

    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(salesCancelMock).not.toHaveBeenCalled()
  })

  it('imprime o cupom a partir do detalhe da venda', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await screen.findByText('#42')

    const row = screen.getByText('#42').closest('tr') as HTMLElement
    await user.click(within(row).getAllByRole('button')[0])
    await user.click(screen.getByRole('button', { name: /Imprimir cupom/ }))

    expect(printReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      expect.objectContaining({ storeName: 'Loja Demo' }),
    )
  })
})
