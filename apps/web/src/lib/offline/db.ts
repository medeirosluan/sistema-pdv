import Dexie, { type Table } from 'dexie';
import type { Customer } from '../customers';
import type { Product } from '../catalog';
import type { CreateSaleInput, Sale } from '../sales';
import type { PendingCashMovement } from './cashQueue';

export interface CachedProduct extends Product {
  tenantId: string;
}

export interface CachedCustomer extends Customer {
  tenantId: string;
}

export interface PendingSale {
  clientId: string;
  tenantId: string;
  createdAt: string;
  payload: CreateSaleInput;
  sale: Sale;
}

interface MetaEntry {
  key: string;
  value: string;
}

class PdvDatabase extends Dexie {
  products!: Table<CachedProduct, string>;
  customers!: Table<CachedCustomer, string>;
  meta!: Table<MetaEntry, string>;
  pendingSales!: Table<PendingSale, string>;
  pendingCashMovements!: Table<PendingCashMovement, string>;

  constructor() {
    super('pdv-offline');
    this.version(1).stores({
      products: 'id, tenantId, name, barcode, sku',
      customers: 'id, tenantId, name',
      meta: 'key',
    });
    this.version(2).stores({
      products: 'id, tenantId, name, barcode, sku',
      customers: 'id, tenantId, name',
      meta: 'key',
      pendingSales: 'clientId, tenantId, createdAt',
    });
    this.version(3).stores({
      products: 'id, tenantId, name, barcode, sku',
      customers: 'id, tenantId, name',
      meta: 'key',
      pendingSales: 'clientId, tenantId, createdAt',
      pendingCashMovements: 'clientId, tenantId, createdAt',
    });
  }
}

export const offlineDb = new PdvDatabase();

export async function setMeta(key: string, value: string): Promise<void> {
  await offlineDb.meta.put({ key, value });
}

export async function getMeta(key: string): Promise<string | undefined> {
  const entry = await offlineDb.meta.get(key);
  return entry?.value;
}
