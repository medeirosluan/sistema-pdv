import { ApiError } from '../api';
import { salesApi } from '../sales';
import { offlineDb, type PendingSale } from './db';

const EVENT = 'pdv-pending-changed';

function emit(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onPendingChanged(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export async function addPendingSale(sale: PendingSale): Promise<void> {
  await offlineDb.pendingSales.put(sale);
  emit();
}

export function listPendingSales(tenantId: string): Promise<PendingSale[]> {
  return offlineDb.pendingSales
    .where('tenantId')
    .equals(tenantId)
    .sortBy('createdAt');
}

export function countPendingSales(tenantId: string): Promise<number> {
  return offlineDb.pendingSales.where('tenantId').equals(tenantId).count();
}

export async function syncPendingSales(
  tenantId: string,
): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingSales(tenantId);
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await salesApi.create(item.payload);
      await offlineDb.pendingSales.delete(item.clientId);
      synced += 1;
    } catch (err) {
      if (err instanceof ApiError) {
        // payload inválido: não vai sincronizar nunca; remove para não travar a fila
        await offlineDb.pendingSales.delete(item.clientId);
        failed += 1;
      } else {
        // falha de rede: mantém na fila e tenta depois
        break;
      }
    }
  }

  emit();
  return { synced, failed };
}
