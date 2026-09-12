import { http } from './api';

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string | number;
  cost: string | number | null;
  unit: string;
  stock: string | number;
  minStock: string | number;
  active: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  parentId: string | null;
  variantName: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { variants: number };
}

/** Nome de exibição do produto, incluindo a variação quando houver (ex.: "Camiseta (P / Azul)"). */
export function productDisplayName(
  product: Pick<Product, 'name' | 'variantName'>,
): string {
  return product.variantName
    ? `${product.name} (${product.variantName})`
    : product.name;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  cost?: number | null;
  unit?: string;
  stock?: number;
  minStock?: number;
  categoryId?: string | null;
  active?: boolean;
  parentId?: string | null;
  variantName?: string | null;
}

export interface ProductQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  active?: boolean;
  parentId?: string;
  topLevelOnly?: boolean;
}

export const categoriesApi = {
  list: () => http.get<Category[]>('/categories'),
  create: (name: string) => http.post<Category>('/categories', { name }),
  update: (id: string, name: string) =>
    http.patch<Category>(`/categories/${id}`, { name }),
  remove: (id: string) => http.delete<{ id: string }>(`/categories/${id}`),
};

export interface ImportProductsResult {
  created: number;
  updated: number;
  errors: string[];
}

export const productsApi = {
  list: (query: ProductQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.active !== undefined) {
      params.set('active', String(query.active));
    }
    if (query.parentId) params.set('parentId', query.parentId);
    if (query.topLevelOnly !== undefined) {
      params.set('topLevelOnly', String(query.topLevelOnly));
    }
    const qs = params.toString();
    return http.get<Paginated<Product>>(`/products${qs ? `?${qs}` : ''}`);
  },
  create: (input: ProductInput) => http.post<Product>('/products', input),
  update: (id: string, input: Partial<ProductInput>) =>
    http.patch<Product>(`/products/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/products/${id}`),
  exportCsv: () =>
    http.get<{ filename: string; csv: string }>('/products/export'),
  importCsv: (csv: string) =>
    http.post<ImportProductsResult>('/products/import', { csv }),
};
