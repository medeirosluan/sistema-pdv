import { ApiError } from '../api';
import { cashApi, type CashMovementType } from '../cash';
import { getMeta, offlineDb, setMeta } from './db';

const EVENT = 'pdv-pending-changed';

export interface PendingCashMovement {
  clientId: string;
  tenantId: string;
  type: CashMovementType;
  amount: number;
  reason?: string;
  createdAt: string;
}

export interface PendingCashOpen {
  clientId: string;
  tenantId: string;
  openingAmount: number;
  createdAt: string;
}

export interface PendingCashClose {
  clientId: string;
  tenantId: string;
  closingAmount: number;
  createdAt: string;
}

function emit(): void {
  window.dispatchEvent(new Event(EVENT));
}

function openKey(tenantId: string): string {
  return `pendingCashOpen:${tenantId}`;
}

function closeKey(tenantId: string): string {
  return `pendingCashClose:${tenantId}`;
}

export async function setPendingCashOpen(
  entry: PendingCashOpen,
): Promise<void> {
  await setMeta(openKey(entry.tenantId), JSON.stringify(entry));
  emit();
}

export async function getPendingCashOpen(
  tenantId: string,
): Promise<PendingCashOpen | null> {
  const raw = await getMeta(openKey(tenantId));
  return raw ? (JSON.parse(raw) as PendingCashOpen) : null;
}

async function clearPendingCashOpen(tenantId: string): Promise<void> {
  await offlineDb.meta.delete(openKey(tenantId));
}

export async function setPendingCashClose(
  entry: PendingCashClose,
): Promise<void> {
  await setMeta(closeKey(entry.tenantId), JSON.stringify(entry));
  emit();
}

export async function getPendingCashClose(
  tenantId: string,
): Promise<PendingCashClose | null> {
  const raw = await getMeta(closeKey(tenantId));
  return raw ? (JSON.parse(raw) as PendingCashClose) : null;
}

async function clearPendingCashClose(tenantId: string): Promise<void> {
  await offlineDb.meta.delete(closeKey(tenantId));
}

export async function countPendingCashSession(
  tenantId: string,
): Promise<number> {
  const [open, close] = await Promise.all([
    getPendingCashOpen(tenantId),
    getPendingCashClose(tenantId),
  ]);
  return (open ? 1 : 0) + (close ? 1 : 0);
}

/**
 * Sincroniza a abertura do caixa feita offline. Deve rodar antes da
 * sincronização de vendas/movimentações e do fechamento, já que essas
 * dependem de um caixa aberto no servidor.
 *
 * Em caso de conflito (ex.: outro dispositivo já abriu o caixa enquanto este
 * estava offline), mantemos o item na fila em vez de descartá-lo como nas
 * demais filas: diferente de um payload inválido, esse conflito pode se
 * resolver sozinho (quando o outro caixa for fechado) e descartar aqui
 * jogaria fora a intenção do operador de abrir o turno.
 */
export async function syncPendingCashOpen(tenantId: string): Promise<void> {
  const pending = await getPendingCashOpen(tenantId);
  if (!pending) {
    return;
  }
  try {
    await cashApi.open(pending.openingAmount, pending.clientId);
    await clearPendingCashOpen(tenantId);
  } catch {
    // ApiError (conflito) ou falha de rede: mantém para tentar de novo.
  } finally {
    emit();
  }
}

/** Sincroniza o fechamento do caixa feito offline. Ver nota em syncPendingCashOpen. */
export async function syncPendingCashClose(tenantId: string): Promise<void> {
  const pending = await getPendingCashClose(tenantId);
  if (!pending) {
    return;
  }
  try {
    await cashApi.close(pending.closingAmount, pending.clientId);
    await clearPendingCashClose(tenantId);
  } catch {
    // idem: mantém para tentar de novo em vez de descartar a ação do operador.
  } finally {
    emit();
  }
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
