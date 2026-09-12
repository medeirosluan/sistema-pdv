import { http } from './api';
import type { Paginated } from './catalog';

export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT' | 'DEBIT';

export type SaleStatus = 'OPEN' | 'FINISHED' | 'CANCELED';

export interface SaleItem {
  id: string;
  productId: string | null;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  discount: string | number;
  total: string | number;
}

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  amount: string | number;
  installments: number;
}

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
}

export function newPaymentLine(
  method: PaymentMethod = 'CASH',
  amount = '',
): PaymentLine {
  return { id: crypto.randomUUID(), method, amount };
}

export interface Sale {
  id: string;
  number: number;
  status: SaleStatus;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  customer: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  items: SaleItem[];
  payments: SalePayment[];
  createdAt: string;
}

export interface CreateSaleItemInput {
  productId?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
}

export interface CreatePaymentInput {
  method: PaymentMethod;
  amount: number;
  installments?: number;
}

export interface CreateSaleInput {
  clientId?: string;
  createdAt?: string;
  customerId?: string | null;
  discount?: number;
  items: CreateSaleItemInput[];
  payments: CreatePaymentInput[];
}

export interface SaleQuery {
  page?: number;
  pageSize?: number;
  status?: SaleStatus;
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
};

export const salesApi = {
  list: (query: SaleQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    return http.get<Paginated<Sale>>(`/sales${qs ? `?${qs}` : ''}`);
  },
  create: (input: CreateSaleInput) => http.post<Sale>('/sales', input),
  findOne: (id: string) => http.get<Sale>(`/sales/${id}`),
  cancel: (id: string) => http.post<Sale>(`/sales/${id}/cancel`),
};
