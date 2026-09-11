import { ApiError } from '../api';
import { cashApi, type CashMovementType } from '../cash';
import { offlineDb } from './db';

const EVENT = 'pdv-pending-changed';

export interface PendingCashMovement {
  clientId: string;
  tenantId: string;
  type: CashMovementType;
  amount: number;
  reason?: string;
  createdAt: string;
}

function emit(): void {
  window.dispatchEvent(new Event(EVENT));
}

export async function addPendingCashMovement(
  movement: PendingCashMovement,
): Promise<void> {
  await offlineDb.pendingCashMovements.put(movement);
  emit();
}

export function listPendingCashMovements(
  tenantId: string,
): Promise<PendingCashMovement[]> {
  return offlineDb.pendingCashMovements
    .where('tenantId')
    .equals(tenantId)
    .sortBy('createdAt');
}

export function countPendingCashMovements(tenantId: string): Promise<number> {
  return offlineDb.pendingCashMovements.where('tenantId').equals(tenantId).count();
}

export async function syncPendingCashMovements(
  tenantId: string,
): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingCashMovements(tenantId);
  let synced = 0;
  let failed = 0;

  for (const movement of pending) {
    try {
      await cashApi.addMovement({
        clientId: movement.clientId,
        type: movement.type,
        amount: movement.amount,
        reason: movement.reason,
      });
      await offlineDb.pendingCashMovements.delete(movement.clientId);
      synced += 1;
    } catch (err) {
      if (err instanceof ApiError) {
        await offlineDb.pendingCashMovements.delete(movement.clientId);
        failed += 1;
      } else {
        break;
      }
    }
  }

  emit();
  return { synced, failed };
}
