import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { CurrentCashRegister } from '../lib/cash'
import type { Product } from '../lib/catalog'
import type { Sale } from '../lib/sales'
import { Pdv } from './Pdv'

const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    name: 'Operador',
    email: 'operador@example.com',
    role: 'CASHIER' as const,
    platformAdmin: false,
    twoFactorEnabled: false,
    permissions: ['sales.create'],
    tenant: {
      id: 'tenant-1',
      name: 'Loja Demo',
      slug: 'loja-demo',
      document: null,
      phone: null,
      email: null,
      address: null,
      settings: {},
      plan: 'FREE',
      status: 'ACTIVE',
    },
  },
}))

const productsListMock = vi.hoisted(() => vi.fn())
const salesCreateMock = vi.hoisted(() => vi.fn())
const customersListMock = vi.hoisted(() => vi.fn())
const addPendingSaleMock = vi.hoisted(() => vi.fn())
const printReceiptMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const cashCurrentMock = vi.hoisted(() =>
  vi.fn<() => Promise<CurrentCashRegister | null>>(),
)

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
  useKiosk: () => ({ kiosk: false, toggle: vi.fn() }),
}))

vi.mock('../components/ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('../lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/catalog')>()
  return {
    ...actual,
    productsApi: { ...actual.productsApi, list: productsListMock },
  }
})

vi.mock('../lib/sales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sales')>()
  return {
    ...actual,
    salesApi: { ...actual.salesApi, create: salesCreateMock },
  }
})

vi.mock('../lib/customers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/customers')>()
  return {
    ...actual,
    customersApi: { ...actual.customersApi, list: customersListMock },
  }
})

vi.mock('../lib/offline/catalogCache', () => ({
  searchCachedProducts: vi.fn(async () => []),
  searchCachedCustomers: vi.fn(async () => []),
}))

vi.mock('../lib/offline/salesQueue', () => ({
  addPendingSale: addPendingSaleMock,
}))

vi.mock('../lib/receipt', () => ({
  printReceipt: printReceiptMock,
}))

vi.mock('../lib/cash', () => ({
  cashApi: { current: cashCurrentMock },
}))

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Água Mineral 500ml',
    sku: null,
    barcode: '789123',
    price: 3,
    cost: null,
    unit: 'UN',
    stock: 50,
    minStock: 5,
    active: true,
    categoryId: null,
    category: null,
    parentId: null,
    variantName: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    number: 1,
    status: 'FINISHED',
    subtotal: 3,
    discount: 0,
    total: 3,
    customer: null,
    createdBy: { id: 'user-1', name: 'Operador' },
    items: [],
    payments: [],
    createdAt: '',
    ...overrides,
  }
}

async function searchAndAddProduct(user: ReturnType<typeof userEvent.setup>) {
  const searchInput = screen.getByPlaceholderText(
    'Buscar ou bipar código de barras — F2',
  )
  await user.type(searchInput, 'Água')
  await waitFor(() => {
    expect(screen.getByText('Água Mineral 500ml')).toBeInTheDocument()
  })
  await user.click(screen.getByText('Água Mineral 500ml'))
}

describe('Pdv', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    productsListMock.mockReset().mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      pageSize: 24,
      totalPages: 1,
    })
    salesCreateMock.mockReset()
    customersListMock.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 8,
      totalPages: 1,
    })
    addPendingSaleMock.mockReset()
    printReceiptMock.mockReset()
    confirmMock.mockReset().mockResolvedValue(true)
    cashCurrentMock.mockReset().mockResolvedValue({
      register: { id: 'reg-1', status: 'OPEN' },
      summary: {},
    } as unknown as CurrentCashRegister)
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
  })

  it('mostra a mensagem inicial pedindo para buscar um produto', () => {
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    expect(
      screen.getByText('Digite o nome ou o código para buscar produtos.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Seu carrinho está vazio')).toBeInTheDocument()
  })

  it('busca produtos após digitar e permite adicionar ao carrinho', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)

    await searchAndAddProduct(user)

    expect(productsListMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Água' }),
    )
    expect(screen.getByText('1 item · 1 un.')).toBeInTheDocument()
    const cartItem = screen.getAllByText('Água Mineral 500ml')[1].closest('li')
    expect(within(cartItem as HTMLElement).getByText('R$ 3,00')).toBeInTheDocument()
  })

  it('prioriza um código de barras exato sobre um item apenas destacado por navegação (leitor de código de barras)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    productsListMock.mockResolvedValue({
      items: [
        product({ id: 'p1', name: 'Água Mineral 500ml', barcode: '789123' }),
        product({ id: 'p2', name: 'Refrigerante Cola', barcode: '999999' }),
      ],
      total: 2,
      page: 1,
      pageSize: 24,
      totalPages: 1,
    })
    render(<MemoryRouter><Pdv /></MemoryRouter>)

    const searchInput = screen.getByPlaceholderText(
      'Buscar ou bipar código de barras — F2',
    )
    // Digita o código de barras exato do segundo produto (simula o leitor).
    await user.type(searchInput, '999999')
    await waitFor(() => {
      expect(screen.getByText('Refrigerante Cola')).toBeInTheDocument()
    })

    // Uma navegação por setas (real ou uma tecla espúria do próprio leitor)
    // destaca o PRIMEIRO produto, que não é o do código digitado.
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(screen.getByText('1 item · 1 un.')).toBeInTheDocument()
    expect(screen.getByText('Refrigerante Cola')).toBeInTheDocument()
    expect(screen.queryByText('Água Mineral 500ml')).not.toBeInTheDocument()
  })

  it('atualiza a quantidade e o total ao clicar em + no carrinho', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    const cartItem = screen.getAllByText('Água Mineral 500ml')[1].closest('li')
    expect(cartItem).not.toBeNull()
    const plusButton = within(cartItem as HTMLElement).getAllByRole('button')[1]
    await user.click(plusButton)

    expect(within(cartItem as HTMLElement).getByText('R$ 6,00')).toBeInTheDocument()
  })

  it('não permite adicionar mais unidades que o estoque disponível', async () => {
    productsListMock.mockResolvedValue({
      items: [product({ stock: 1 })],
      total: 1,
      page: 1,
      pageSize: 24,
      totalPages: 1,
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    const cartItem = screen.getAllByText('Água Mineral 500ml')[1].closest('li')
    const plusButton = within(cartItem as HTMLElement).getAllByRole('button')[1]
    expect(plusButton).toBeDisabled()

    await user.click(screen.getAllByText('Água Mineral 500ml')[0])
    expect(screen.getByText(/Estoque máximo atingido para Água Mineral 500ml/)).toBeInTheDocument()
    expect(within(cartItem as HTMLElement).getByText('R$ 3,00')).toBeInTheDocument()
  })

  it('remove o produto do carrinho e permite desfazer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    const cartItem = screen.getAllByText('Água Mineral 500ml')[1].closest('li')
    const buttons = within(cartItem as HTMLElement).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    expect(screen.getByText('Seu carrinho está vazio')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getAllByText('Água Mineral 500ml')).toHaveLength(2)
  })

  it('mantém a venda em espera após recarregar a tela', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    await user.click(screen.getByRole('button', { name: 'Colocar em espera (F7)' }))
    expect(screen.getByRole('button', { name: '1 em espera' })).toBeInTheDocument()

    view.unmount()
    render(<MemoryRouter><Pdv /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: '1 em espera' })).toBeInTheDocument()
  })

  it('restaura o carrinho em andamento após recarregar a tela', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const view = render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    view.unmount()
    render(<MemoryRouter><Pdv /></MemoryRouter>)

    expect(await screen.findByText('Água Mineral 500ml')).toBeInTheDocument()
    expect(screen.getByText('1 item · 1 un.')).toBeInTheDocument()
  })

  it('desabilita finalizar quando o carrinho está vazio', () => {
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    expect(
      screen.getByRole('button', { name: /Finalizar venda/ }),
    ).toBeDisabled()
  })

  it('finaliza a venda com sucesso via pagamento e mostra a confirmação', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    salesCreateMock.mockResolvedValue(sale())
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    await user.click(screen.getByRole('button', { name: /Finalizar venda/ }))
    const dialog = screen.getByRole('dialog')
    const amountInput = within(dialog).getByPlaceholderText('0,00')
    await user.type(amountInput, '3')
    await user.click(within(dialog).getByRole('button', { name: /Finalizar/ }))

    await waitFor(() => {
      expect(salesCreateMock).toHaveBeenCalled()
    })
    expect(
      await screen.findByText('Venda #1 finalizada — R$ 3,00'),
    ).toBeInTheDocument()
    expect(screen.getByText('Seu carrinho está vazio')).toBeInTheDocument()
  })

  it('bloqueia a venda e avisa quando o caixa está fechado', async () => {
    cashCurrentMock.mockResolvedValueOnce(null)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    expect(
      await screen.findByText('Caixa fechado — abra o caixa antes de vender.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Finalizar venda/ }),
    ).toBeDisabled()
  })

  it('guarda a venda offline quando a API falha por conexão', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    salesCreateMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    await user.click(screen.getByRole('button', { name: /Finalizar venda/ }))
    const dialog = screen.getByRole('dialog')
    const amountInput = within(dialog).getByPlaceholderText('0,00')
    await user.type(amountInput, '3')
    await user.click(within(dialog).getByRole('button', { name: /Finalizar/ }))

    await waitFor(() => {
      expect(addPendingSaleMock).toHaveBeenCalled()
    })
    expect(
      await screen.findByText(/Venda registrada offline/),
    ).toBeInTheDocument()
  })

  it('cancela a venda atual após confirmação, esvaziando o carrinho', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MemoryRouter><Pdv /></MemoryRouter>)
    await searchAndAddProduct(user)

    confirmMock.mockResolvedValue(true)
    // dispara o atalho F6 (cancelar/limpar venda)
    await user.keyboard('{F6}')

    await waitFor(() => {
      expect(
        screen.getByText('Seu carrinho está vazio'),
      ).toBeInTheDocument()
    })
  })
})
