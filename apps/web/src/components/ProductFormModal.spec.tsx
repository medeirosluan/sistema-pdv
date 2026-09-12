import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../lib/catalog'
import { ProductFormModal } from './ProductFormModal'

const productsCreateMock = vi.hoisted(() => vi.fn())
const productsUpdateMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/catalog')>()
  return {
    ...actual,
    productsApi: {
      ...actual.productsApi,
      create: productsCreateMock,
      update: productsUpdateMock,
    },
  }
})

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

describe('ProductFormModal', () => {
  beforeEach(() => {
    productsCreateMock.mockReset().mockResolvedValue({ id: 'new' })
    productsUpdateMock.mockReset().mockResolvedValue({ id: 'updated' })
  })

  it('cria um produto normal sem parentId/variantName quando não há produto base', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <ProductFormModal
        open
        product={null}
        categories={[]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    await user.type(screen.getByLabelText('Nome *'), 'Produto Normal')
    await user.type(screen.getByLabelText('Preço *'), '10')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(productsCreateMock).toHaveBeenCalled())
    const payload = productsCreateMock.mock.calls[0][0]
    expect(payload.parentId).toBeUndefined()
    expect(payload.variantName).toBeUndefined()
  })

  it('pré-preenche nome, preço e categoria a partir do produto base ao criar uma variação', () => {
    render(
      <ProductFormModal
        open
        product={null}
        categories={[]}
        parentProduct={parentProduct({ categoryId: 'cat-1', price: 75 })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Nome *')).toHaveValue('Camiseta')
    expect(screen.getByLabelText('Nome *')).toBeDisabled()
    expect(screen.getByLabelText('Preço *')).toHaveValue('75')
    expect(screen.getByLabelText('Nome da variação *')).toBeInTheDocument()
  })

  it('exige o nome da variação e envia parentId ao criar uma variação', async () => {
    const user = userEvent.setup()
    render(
      <ProductFormModal
        open
        product={null}
        categories={[]}
        parentProduct={parentProduct()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Nome da variação *'), 'P / Azul')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(productsCreateMock).toHaveBeenCalled())
    expect(productsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Camiseta',
        parentId: 'parent-1',
        variantName: 'P / Azul',
      }),
    )
  })

  it('usa o título "Nova variação" / "Editar variação" quando há um produto base', () => {
    const { rerender } = render(
      <ProductFormModal
        open
        product={null}
        categories={[]}
        parentProduct={parentProduct()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.getByText('Nova variação')).toBeInTheDocument()

    rerender(
      <ProductFormModal
        open
        product={parentProduct({ id: 'v1', variantName: 'M / Preto' })}
        categories={[]}
        parentProduct={parentProduct()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.getByText('Editar variação')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da variação *')).toHaveValue(
      'M / Preto',
    )
  })
})
