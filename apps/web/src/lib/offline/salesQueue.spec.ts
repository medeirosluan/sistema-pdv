import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api'
import type { CreateSaleInput, Sale } from '../sales'
import { offlineDb, type PendingSale } from './db'

const salesCreateMock = vi.hoisted(() => vi.fn())

vi.mock('../sales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sales')>()
  return {
    ...actual,
    salesApi: { ...actual.salesApi, create: salesCreateMock },
  }
})

import {
  addPendingSale,
  countPendingSales,
  listPendingSales,
  onPendingChanged,
  syncPendingSales,
} from './salesQueue'

function makePendingSale(overrides: Partial<PendingSale> = {}): PendingSale {
  const payload: CreateSaleInput = {
    clientId: overrides.clientId as string | undefined,
    items: [{ productId: 'p1', quantity: 1 }],
    payments: [{ method: 'CASH', amount: 10 }],
  }
  const sale: Sale = {
    id: overrides.clientId ?? 'client-1',
    number: 0,
    status: 'FINISHED',
    subtotal: 10,
    discount: 0,
    total: 10,
    customer: null,
    createdBy: { id: 'u1', name: 'Operador' },
    items: [],
    payments: [],
    createdAt: '2026-01-15T10:00:00Z',
  }
  return {
    clientId: 'client-1',
    tenantId: 'tenant-1',
    createdAt: '2026-01-15T10:00:00Z',
    payload,
    sale,
    ...overrides,
  }
}

describe('salesQueue', () => {
  beforeEach(() => {
    salesCreateMock.mockReset()
  })

  afterEach(async () => {
    await offlineDb.pendingSales.clear()
  })

  it('adiciona e lista vendas pendentes por tenant, ordenadas por data', async () => {
    await addPendingSale(
      makePendingSale({
        clientId: 'c2',
        tenantId: 'tenant-1',
        createdAt: '2026-01-15T12:00:00Z',
      }),
    )
    await addPendingSale(
      makePendingSale({
        clientId: 'c1',
        tenantId: 'tenant-1',
        createdAt: '2026-01-15T10:00:00Z',
      }),
    )
    await addPendingSale(makePendingSale({ clientId: 'c3', tenantId: 'outro-tenant' }))

    const items = await listPendingSales('tenant-1')

    expect(items.map((item) => item.clientId)).toEqual(['c1', 'c2'])
    expect(await countPendingSales('tenant-1')).toBe(2)
  })

  it('dispara o evento pdv-pending-changed ao adicionar uma venda', async () => {
    const handler = vi.fn()
    const unsubscribe = onPendingChanged(handler)

    await addPendingSale(makePendingSale())

    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('sincroniza vendas pendentes com sucesso e as remove da fila', async () => {
    await addPendingSale(makePendingSale({ clientId: 'c1' }))
    salesCreateMock.mockResolvedValue({})

    const result = await syncPendingSales('tenant-1')

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(await countPendingSales('tenant-1')).toBe(0)
  })

  it('remove da fila e conta como falha quando a API rejeita definitivamente (ApiError)', async () => {
    await addPendingSale(makePendingSale({ clientId: 'c1' }))
    salesCreateMock.mockRejectedValue(new ApiError(400, 'Produto inválido'))

    const result = await syncPendingSales('tenant-1')

    expect(result).toEqual({ synced: 0, failed: 1 })
    expect(await countPendingSales('tenant-1')).toBe(0)
  })

  it('mantém na fila e para de tentar quando a falha é de rede (não-ApiError)', async () => {
    await addPendingSale(
      makePendingSale({ clientId: 'c1', createdAt: '2026-01-15T09:00:00Z' }),
    )
    await addPendingSale(
      makePendingSale({ clientId: 'c2', createdAt: '2026-01-15T10:00:00Z' }),
    )
    salesCreateMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await syncPendingSales('tenant-1')

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(await countPendingSales('tenant-1')).toBe(2)
    expect(salesCreateMock).toHaveBeenCalledTimes(1)
  })

  it('processa itens até encontrar uma falha de rede, mantendo os restantes', async () => {
    await addPendingSale(
      makePendingSale({ clientId: 'c1', createdAt: '2026-01-15T09:00:00Z' }),
    )
    await addPendingSale(
      makePendingSale({ clientId: 'c2', createdAt: '2026-01-15T10:00:00Z' }),
    )
    salesCreateMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await syncPendingSales('tenant-1')

    expect(result).toEqual({ synced: 1, failed: 0 })
    const remaining = await listPendingSales('tenant-1')
    expect(remaining.map((item) => item.clientId)).toEqual(['c2'])
  })
})
