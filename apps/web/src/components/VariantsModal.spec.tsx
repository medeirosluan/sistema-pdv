import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../lib/catalog'
import { VariantsModal } from './VariantsModal'

const productsListMock = vi.hoisted(() => vi.fn())
const productsRemoveMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('../lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/catalog')>()
  return {
    ...actual,
    productsApi: {
      ...actual.productsApi,
      list: productsListMock,
      remove: productsRemoveMock,
    },
  }
})

vi.mock('./ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('./ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('./ProductFormModal', () => ({
  ProductFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="product-form-modal" /> : null,
}))

function parentProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'parent-1',
    name: 'Camiseta',
    sku: null,
    barcode: null,
    price: 50,
    cost: null,
    unit: 'UN',
    stock: 0,
    minStock: 0,
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

function variant(overrides: Partial<Product> = {}): Product {
  return parentProduct({
    id: 'v1',
    parentId: 'parent-1',
    variantName: 'P / Azul',
    price: 55,
    stock: 10,
    ...overrides,
  })
}

function paginated(items: Product[]) {
  return { items, total: items.length, page: 1, pageSize: 100, totalPages: 1 }
}

describe('VariantsModal', () => {
  beforeEach(() => {
    productsListMock.mockReset().mockResolvedValue(paginated([]))
    productsRemoveMock.mockReset().mockResolvedValue({ id: 'v1' })
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('busca as variações do produto informado', async () => {
    render(
      <VariantsModal
        open
        product={parentProduct()}
        categories={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(productsListMock).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'parent-1' }),
      )
    })
  })

  it('lista as variações existentes', async () => {
    productsListMock.mockResolvedValue(paginated([variant()]))
    render(
      <VariantsModal
        open
        product={parentProduct()}
        categories={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    )

    expect(await screen.findByText('P / Azul')).toBeInTheDocument()
    expect(screen.getByText('R$ 55,00')).toBeInTheDocument()
  })

  it('mostra mensagem de vazio quando não há variações', async () => {
    render(
      <VariantsModal
        open
        product={parentProduct()}
        categories={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    )

    expect(
      await screen.findByText('Nenhuma variação cadastrada.'),
    ).toBeInTheDocument()
  })

  it('abre o formulário ao clicar em "Nova variação"', async () => {
    const user = userEvent.setup()
    render(
      <VariantsModal
        open
        product={parentProduct()}
        categories={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    )
    await waitFor(() => expect(productsListMock).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /Nova variação/ }))

    expect(screen.getByTestId('product-form-modal')).toBeInTheDocument()
  })

  it('exclui uma variação após confirmação e notifica a mudança', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    productsListMock.mockResolvedValue(paginated([variant()]))
    render(
      <VariantsModal
        open
        product={parentProduct()}
        categories={[]}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    )
    await screen.findByText('P / Azul')

    const row = screen.getByText('P / Azul').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(productsRemoveMock).toHaveBeenCalledWith('v1')
    })
    expect(toastMock.success).toHaveBeenCalledWith('Variação excluída.')
    expect(onChanged).toHaveBeenCalled()
  })
})
