import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../catalog'
import type { Customer } from '../customers'
import { offlineDb } from './db'

const productsListMock = vi.hoisted(() => vi.fn())
const customersListMock = vi.hoisted(() => vi.fn())

vi.mock('../catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../catalog')>()
  return {
    ...actual,
    productsApi: { ...actual.productsApi, list: productsListMock },
  }
})

vi.mock('../customers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../customers')>()
  return {
    ...actual,
    customersApi: { ...actual.customersApi, list: customersListMock },
  }
})

import {
  getLastSync,
  refreshCatalog,
  searchCachedCustomers,
  searchCachedProducts,
} from './catalogCache'

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
    parentId: null,
    variantName: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'João da Silva',
    document: null,
    phone: null,
    email: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('catalogCache', () => {
  beforeEach(() => {
    productsListMock.mockReset()
    customersListMock.mockReset()
  })

  afterEach(async () => {
    await offlineDb.products.clear()
    await offlineDb.customers.clear()
    await offlineDb.meta.clear()
  })

  describe('refreshCatalog', () => {
    it('busca todas as páginas de produtos e clientes e grava no cache local', async () => {
      productsListMock
        .mockResolvedValueOnce({
          items: [makeProduct({ id: 'p1' })],
          total: 2,
          page: 1,
          pageSize: 1,
          totalPages: 2,
        })
        .mockResolvedValueOnce({
          items: [makeProduct({ id: 'p2', name: 'Feijão 1kg' })],
          total: 2,
          page: 2,
          pageSize: 1,
          totalPages: 2,
        })
      customersListMock.mockResolvedValue({
        items: [makeCustomer()],
        total: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })

      const result = await refreshCatalog('tenant-1')

      expect(result).toEqual({ products: 2, customers: 1 })
      const cachedProducts = await offlineDb.products
        .where('tenantId')
        .equals('tenant-1')
        .toArray()
      expect(cachedProducts.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
      expect(await getLastSync('tenant-1')).toBeTruthy()
    })

    it('substitui o cache anterior do tenant em vez de acumular', async () => {
      await offlineDb.products.put({ ...makeProduct({ id: 'antigo' }), tenantId: 'tenant-1' })
      productsListMock.mockResolvedValue({
        items: [makeProduct({ id: 'novo' })],
        total: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })
      customersListMock.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })

      await refreshCatalog('tenant-1')

      const cachedProducts = await offlineDb.products
        .where('tenantId')
        .equals('tenant-1')
        .toArray()
      expect(cachedProducts.map((p) => p.id)).toEqual(['novo'])
    })

    it('não afeta o cache de outro tenant', async () => {
      await offlineDb.products.put({ ...makeProduct({ id: 'outro-produto' }), tenantId: 'outro-tenant' })
      productsListMock.mockResolvedValue({
        items: [makeProduct({ id: 'p1' })],
        total: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })
      customersListMock.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })

      await refreshCatalog('tenant-1')

      const outros = await offlineDb.products
        .where('tenantId')
        .equals('outro-tenant')
        .toArray()
      expect(outros).toHaveLength(1)
    })
  })

  describe('searchCachedProducts', () => {
    beforeEach(async () => {
      await offlineDb.products.bulkPut([
        { ...makeProduct({ id: 'p1', name: 'Arroz 5kg', barcode: '111', sku: 'ARZ' }), tenantId: 'tenant-1' },
        { ...makeProduct({ id: 'p2', name: 'Feijão 1kg', barcode: '222', sku: 'FEI' }), tenantId: 'tenant-1' },
        { ...makeProduct({ id: 'p3', name: 'Água Mineral', barcode: '333', sku: null }), tenantId: 'outro-tenant' },
      ])
    })

    it('retorna vazio quando o termo de busca é vazio', async () => {
      expect(await searchCachedProducts('tenant-1', '  ')).toEqual([])
    })

    it('busca por nome (case-insensitive)', async () => {
      const result = await searchCachedProducts('tenant-1', 'arroz')
      expect(result.map((p) => p.id)).toEqual(['p1'])
    })

    it('busca por código de barras e por SKU', async () => {
      expect((await searchCachedProducts('tenant-1', '222'))[0]?.id).toBe('p2')
      expect((await searchCachedProducts('tenant-1', 'fei'))[0]?.id).toBe('p2')
    })

    it('não retorna produtos de outro tenant', async () => {
      const result = await searchCachedProducts('tenant-1', 'água')
      expect(result).toEqual([])
    })

    it('ordena os resultados por nome', async () => {
      const result = await searchCachedProducts('tenant-1', 'k')
      expect(result.map((p) => p.name)).toEqual(['Arroz 5kg', 'Feijão 1kg'])
    })
  })

  describe('searchCachedCustomers', () => {
    beforeEach(async () => {
      await offlineDb.customers.bulkPut([
        { ...makeCustomer({ id: 'c1', name: 'João da Silva' }), tenantId: 'tenant-1' },
        { ...makeCustomer({ id: 'c2', name: 'Maria Souza' }), tenantId: 'tenant-1' },
        { ...makeCustomer({ id: 'c3', name: 'Outro tenant' }), tenantId: 'outro-tenant' },
      ])
    })

    it('retorna os primeiros clientes do tenant quando o termo é vazio', async () => {
      const result = await searchCachedCustomers('tenant-1', '')
      expect(result.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    })

    it('filtra por nome (case-insensitive)', async () => {
      const result = await searchCachedCustomers('tenant-1', 'maria')
      expect(result.map((c) => c.id)).toEqual(['c2'])
    })

    it('não retorna clientes de outro tenant', async () => {
      const result = await searchCachedCustomers('tenant-1', 'outro')
      expect(result).toEqual([])
    })
  })
})
