import { http } from './api';
import type { Paginated } from './catalog';

export interface Customer {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const customersApi = {
  list: (query: CustomerQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return http.get<Paginated<Customer>>(`/customers${qs ? `?${qs}` : ''}`);
  },
  create: (input: CustomerInput) => http.post<Customer>('/customers', input),
  update: (id: string, input: Partial<CustomerInput>) =>
    http.patch<Customer>(`/customers/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/customers/${id}`),
};
