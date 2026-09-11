import { http } from './api';
import type { Paginated } from './catalog';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: string | number;
  previousStock: string | number;
  newStock: string | number;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string; unit: string };
  createdBy: { id: string; name: string };
}

export interface LowStockProduct {
  id: string;
  name: string;
  unit: string;
  stock: string | number;
  minStock: string | number;
}

export interface CreateStockMovementInput {
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

export const stockMovementLabels: Record<StockMovementType, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUST: 'Ajuste',
};

export const stockApi = {
  movements: (productId: string, page = 1, pageSize = 10) =>
    http.get<Paginated<StockMovement>>(
      `/stock/products/${productId}/movements?page=${page}&pageSize=${pageSize}`,
    ),
  register: (productId: string, input: CreateStockMovementInput) =>
    http.post<{
      movement: StockMovement;
      product: { id: string; stock: string | number };
    }>(`/stock/products/${productId}/movements`, input),
  lowStock: () => http.get<LowStockProduct[]>('/stock/low-stock'),
};
