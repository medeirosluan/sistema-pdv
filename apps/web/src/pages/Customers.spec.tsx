import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Customer } from '../lib/customers'
import { Customers } from './Customers'

const permissionsState = vi.hoisted(() => ({
  granted: new Set<string>(['customers.manage']),
}))

const customersListMock = vi.hoisted(() => vi.fn())
const customersRemoveMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))

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

vi.mock('../lib/customers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/customers')>()
  return {
    ...actual,
    customersApi: {
      ...actual.customersApi,
      list: customersListMock,
      remove: customersRemoveMock,
    },
  }
})

vi.mock('../components/CustomerFormModal', () => ({
  CustomerFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="customer-form-modal" /> : null,
}))

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'João da Silva',
    document: '123.456.789-00',
    phone: '11999999999',
    email: 'joao@example.com',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function paginated(items: Customer[], overrides: Partial<{ total: number; totalPages: number }> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: 1,
    pageSize: 10,
    totalPages: overrides.totalPages ?? 1,
  }
}

describe('Customers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    permissionsState.granted = new Set(['customers.manage'])
    customersListMock.mockReset().mockResolvedValue(paginated([makeCustomer()]))
    customersRemoveMock.mockReset().mockResolvedValue({ id: 'c1' })
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('lista os clientes com telefone e e-mail', async () => {
    render(<Customers />)

    expect(await screen.findByText('João da Silva')).toBeInTheDocument()
    expect(screen.getByText('11999999999')).toBeInTheDocument()
    expect(screen.getByText('joao@example.com')).toBeInTheDocument()
  })

  it('mostra travessão quando telefone/e-mail estão ausentes', async () => {
    customersListMock.mockResolvedValue(
      paginated([makeCustomer({ phone: null, email: null })]),
    )
    render(<Customers />)
    await screen.findByText('João da Silva')

    const row = screen.getByText('João da Silva').closest('tr') as HTMLElement
    expect(within(row).getAllByText('—')).toHaveLength(2)
  })

  it('busca clientes com debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Customers />)
    await screen.findByText('João da Silva')

    await user.type(
      screen.getByPlaceholderText('Buscar por nome, documento, telefone ou e-mail'),
      'joao',
    )

    await waitFor(() => {
      expect(customersListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'joao', page: 1 }),
      )
    })
  })

  it('oculta as ações e o botão de novo cliente sem a permissão customers.manage', async () => {
    permissionsState.granted = new Set([])
    render(<Customers />)
    await screen.findByText('João da Silva')

    expect(
      screen.queryByRole('button', { name: /Novo cliente/ }),
    ).not.toBeInTheDocument()
    const row = screen.getByText('João da Silva').closest('tr') as HTMLElement
    expect(within(row).queryAllByRole('button')).toHaveLength(0)
  })

  it('abre o formulário de criação', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Customers />)
    await screen.findByText('João da Silva')

    await user.click(screen.getByRole('button', { name: /Novo cliente/ }))

    expect(screen.getByTestId('customer-form-modal')).toBeInTheDocument()
  })

  it('exclui o cliente após confirmação e recarrega a lista', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Customers />)
    await screen.findByText('João da Silva')

    const row = screen.getByText('João da Silva').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(customersRemoveMock).toHaveBeenCalledWith('c1')
    })
    expect(toastMock.success).toHaveBeenCalledWith('Cliente excluído.')
  })

  it('não exclui quando a confirmação é cancelada', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    confirmMock.mockResolvedValue(false)
    render(<Customers />)
    await screen.findByText('João da Silva')

    const row = screen.getByText('João da Silva').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(customersRemoveMock).not.toHaveBeenCalled()
  })

  it('navega entre páginas', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    customersListMock.mockResolvedValue(
      paginated([makeCustomer()], { total: 25, totalPages: 3 }),
    )
    render(<Customers />)
    await screen.findByText('João da Silva')

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => {
      expect(customersListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
  })
})
