import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api'
import { offlineDb } from './db'

const cashAddMovementMock = vi.hoisted(() => vi.fn())

vi.mock('../cash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cash')>()
  return {
    ...actual,
    cashApi: { ...actual.cashApi, addMovement: cashAddMovementMock },
  }
})

import {
  addPendingCashMovement,
  countPendingCashMovements,
  listPendingCashMovements,
  type PendingCashMovement,
  syncPendingCashMovements,
} from './cashQueue'

function makeMovement(overrides: Partial<PendingCashMovement> = {}): PendingCashMovement {
  return {
    clientId: 'c1',
    tenantId: 'tenant-1',
    type: 'WITHDRAWAL',
    amount: 50,
    reason: 'sangria',
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

describe('cashQueue', () => {
  beforeEach(() => {
    cashAddMovementMock.mockReset()
  })

  afterEach(async () => {
    await offlineDb.pendingCashMovements.clear()
  })

  it('adiciona e lista movimentos pendentes por tenant, ordenados por data', async () => {
    await addPendingCashMovement(
      makeMovement({ clientId: 'c2', createdAt: '2026-01-15T12:00:00Z' }),
    )
    await addPendingCashMovement(
      makeMovement({ clientId: 'c1', createdAt: '2026-01-15T10:00:00Z' }),
    )
    await addPendingCashMovement(makeMovement({ clientId: 'c3', tenantId: 'outro' }))

    const items = await listPendingCashMovements('tenant-1')

    expect(items.map((item) => item.clientId)).toEqual(['c1', 'c2'])
    expect(await countPendingCashMovements('tenant-1')).toBe(2)
  })

  it('sincroniza movimentos pendentes com sucesso e os remove da fila', async () => {
    await addPendingCashMovement(makeMovement())
    cashAddMovementMock.mockResolvedValue({})

    const result = await syncPendingCashMovements('tenant-1')

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(await countPendingCashMovements('tenant-1')).toBe(0)
    expect(cashAddMovementMock).toHaveBeenCalledWith({
      clientId: 'c1',
      type: 'WITHDRAWAL',
      amount: 50,
      reason: 'sangria',
    })
  })

  it('remove da fila e conta como falha quando a API rejeita definitivamente (ApiError)', async () => {
    await addPendingCashMovement(makeMovement())
    cashAddMovementMock.mockRejectedValue(new ApiError(404, 'Caixa não encontrado'))

    const result = await syncPendingCashMovements('tenant-1')

    expect(result).toEqual({ synced: 0, failed: 1 })
    expect(await countPendingCashMovements('tenant-1')).toBe(0)
  })

  it('mantém na fila e para de tentar quando a falha é de rede', async () => {
    await addPendingCashMovement(makeMovement({ clientId: 'c1' }))
    await addPendingCashMovement(
      makeMovement({ clientId: 'c2', createdAt: '2026-01-15T11:00:00Z' }),
    )
    cashAddMovementMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await syncPendingCashMovements('tenant-1')

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(await countPendingCashMovements('tenant-1')).toBe(2)
    expect(cashAddMovementMock).toHaveBeenCalledTimes(1)
  })
})
