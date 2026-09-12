import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Product } from '../lib/catalog'
import { Products } from './Products'

const permissionsState = vi.hoisted(() => ({
  granted: new Set<string>(['products.view', 'products.manage', 'categories.manage', 'stock.manage']),
}))

const productsListMock = vi.hoisted(() => vi.fn())
const productsRemoveMock = vi.hoisted(() => vi.fn())
const productsExportCsvMock = vi.hoisted(() => vi.fn())
const productsImportCsvMock = vi.hoisted(() => vi.fn())
const categoriesListMock = vi.hoisted(() => vi.fn())
const downloadTextFileMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
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

vi.mock('../lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/catalog')>()
  return {
    ...actual,
    productsApi: {
      ...actual.productsApi,
      list: productsListMock,
      remove: productsRemoveMock,
      exportCsv: productsExportCsvMock,
      importCsv: productsImportCsvMock,
    },
    categoriesApi: { ...actual.categoriesApi, list: categoriesListMock },
  }
})

vi.mock('../lib/csv', () => ({
  downloadTextFile: downloadTextFileMock,
}))

vi.mock('../components/ProductFormModal', () => ({
  ProductFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="product-form-modal" /> : null,
}))

vi.mock('../components/CategoriesModal', () => ({
  CategoriesModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="categories-modal" /> : null,
}))

vi.mock('../components/StockModal', () => ({
  StockModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="stock-modal" /> : null,
}))

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Arroz 5kg',
    sku: 'ARZ5',
    barcode: '7891234567890',
    price: 24.9,
    cost: null,
    unit: 'UN',
    stock: 15,
    minStock: 5,
    active: true,
    categoryId: null,
    category: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function paginated(items: Product[], overrides: Partial<{ total: number; totalPages: number; page: number }> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    pageSize: 10,
    totalPages: overrides.totalPages ?? 1,
  }
}

const categories: Category[] = [
  { id: 'c1', name: 'Mercearia', createdAt: '', updatedAt: '' },
]

describe('Products', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    permissionsState.granted = new Set([
      'products.view',
      'products.manage',
      'categories.manage',
      'stock.manage',
    ])
    productsListMock.mockReset().mockResolvedValue(paginated([makeProduct()]))
    productsRemoveMock.mockReset().mockResolvedValue({ id: 'p1' })
    productsExportCsvMock
      .mockReset()
      .mockResolvedValue({ filename: 'produtos.csv', csv: 'a;b' })
    productsImportCsvMock.mockReset()
    categoriesListMock.mockReset().mockResolvedValue(categories)
    downloadTextFileMock.mockReset()
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.info.mockReset()
  })

  it('carrega e lista os produtos ao montar', async () => {
    render(<Products />)

    expect(await screen.findByText('Arroz 5kg')).toBeInTheDocument()
    expect(productsListMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
    )
  })

  it('destaca produtos com estoque igual ou abaixo do mínimo', async () => {
    productsListMock.mockResolvedValue(
      paginated([makeProduct({ stock: 2, minStock: 5 })]),
    )
    render(<Products />)

    expect(await screen.findByText('baixo')).toBeInTheDocument()
  })

  it('busca produtos após digitar (com debounce)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    await user.type(
      screen.getByPlaceholderText('Buscar por nome, SKU ou código de barras'),
      'feijão',
    )

    await waitFor(() => {
      expect(productsListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'feijão', page: 1 }),
      )
    })
  })

  it('filtra por categoria selecionada', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    await user.selectOptions(screen.getByRole('combobox'), 'c1')

    await waitFor(() => {
      expect(productsListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoryId: 'c1' }),
      )
    })
  })

  it('navega para a próxima página e desabilita "Anterior" na primeira', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    productsListMock.mockResolvedValue(
      paginated([makeProduct()], { total: 25, totalPages: 3 }),
    )
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => {
      expect(productsListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
  })

  it('oculta ações de gerenciamento quando o usuário não tem permissão', async () => {
    permissionsState.granted = new Set(['products.view'])
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    expect(
      screen.queryByRole('button', { name: /Novo produto/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Importar/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Categorias/ }),
    ).not.toBeInTheDocument()
  })

  it('abre o formulário de criação ao clicar em "Novo produto"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    await user.click(screen.getByRole('button', { name: /Novo produto/ }))

    expect(screen.getByTestId('product-form-modal')).toBeInTheDocument()
  })

  it('exclui o produto após confirmação e recarrega a lista', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    const row = screen.getByText('Arroz 5kg').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(productsRemoveMock).toHaveBeenCalledWith('p1')
    })
    expect(toastMock.success).toHaveBeenCalledWith('Produto excluído.')
    expect(productsListMock.mock.calls.length).toBeGreaterThan(1)
  })

  it('não exclui quando a confirmação é cancelada', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    confirmMock.mockResolvedValue(false)
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    const row = screen.getByText('Arroz 5kg').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(productsRemoveMock).not.toHaveBeenCalled()
  })

  it('exporta o CSV e dispara o download', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Products />)
    await screen.findByText('Arroz 5kg')

    await user.click(screen.getByRole('button', { name: /Exportar/ }))

    await waitFor(() => {
      expect(downloadTextFileMock).toHaveBeenCalledWith('produtos.csv', 'a;b')
    })
    expect(toastMock.success).toHaveBeenCalledWith('CSV exportado.')
  })
})
