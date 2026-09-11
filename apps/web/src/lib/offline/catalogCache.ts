import { productsApi, type Product } from '../catalog';
import { customersApi, type Customer } from '../customers';
import { getMeta, offlineDb, setMeta } from './db';

const PAGE_SIZE = 100;

async function fetchAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  let page = 1;
  for (;;) {
    const data = await productsApi.list({ page, pageSize: PAGE_SIZE });
    all.push(...data.items);
    if (page >= data.totalPages) {
      break;
    }
    page += 1;
  }
  return all;
}

async function fetchAllCustomers(): Promise<Customer[]> {
  const all: Customer[] = [];
  let page = 1;
  for (;;) {
    const data = await customersApi.list({ page, pageSize: PAGE_SIZE });
    all.push(...data.items);
    if (page >= data.totalPages) {
      break;
    }
    page += 1;
  }
  return all;
}

export async function refreshCatalog(
  tenantId: string,
): Promise<{ products: number; customers: number }> {
  const [products, customers] = await Promise.all([
    fetchAllProducts(),
    fetchAllCustomers(),
  ]);

  await offlineDb.transaction(
    'rw',
    offlineDb.products,
    offlineDb.customers,
    offlineDb.meta,
    async () => {
      await offlineDb.products.where('tenantId').equals(tenantId).delete();
      await offlineDb.customers.where('tenantId').equals(tenantId).delete();
      await offlineDb.products.bulkPut(
        products.map((product) => ({ ...product, tenantId })),
      );
      await offlineDb.customers.bulkPut(
        customers.map((customer) => ({ ...customer, tenantId })),
      );
      await setMeta(`lastSync:${tenantId}`, new Date().toISOString());
    },
  );

  return { products: products.length, customers: customers.length };
}

export function getLastSync(tenantId: string): Promise<string | undefined> {
  return getMeta(`lastSync:${tenantId}`);
}

export async function searchCachedProducts(
  tenantId: string,
  term: string,
): Promise<Product[]> {
  const raw = term.trim();
  if (!raw) {
    return [];
  }
  const normalized = raw.toLowerCase();
  const all = await offlineDb.products
    .where('tenantId')
    .equals(tenantId)
    .toArray();

  return all
    .filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) ||
        (product.barcode ?? '').includes(raw) ||
        (product.sku ?? '').toLowerCase().includes(normalized),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 24);
}

export async function searchCachedCustomers(
  tenantId: string,
  term: string,
): Promise<Customer[]> {
  const normalized = term.trim().toLowerCase();
  const all = await offlineDb.customers
    .where('tenantId')
    .equals(tenantId)
    .toArray();
  if (!normalized) {
    return all.slice(0, 8);
  }
  return all
    .filter((customer) => customer.name.toLowerCase().includes(normalized))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
}
