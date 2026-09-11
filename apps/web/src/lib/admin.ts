import { http } from './api';
import type { Paginated } from './catalog';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
export type TenantPlanKey = 'FREE' | 'BASIC' | 'PRO';

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  plan: TenantPlanKey;
  status: TenantStatus;
  createdAt: string;
  _count: { users: number; products: number; sales: number };
}

export interface AdminSummary {
  tenants: number;
  activeTenants: number;
  users: number;
  products: number;
  sales: number;
}

export interface TenantQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface UpdateTenantAdminInput {
  plan?: TenantPlanKey;
  status?: TenantStatus;
}

export const planLabels: Record<TenantPlanKey, string> = {
  FREE: 'Grátis',
  BASIC: 'Básico',
  PRO: 'Pro',
};

export const statusLabels: Record<TenantStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
};

export const adminApi = {
  summary: () => http.get<AdminSummary>('/admin/summary'),
  tenants: (query: TenantQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return http.get<Paginated<AdminTenant>>(
      `/admin/tenants${qs ? `?${qs}` : ''}`,
    );
  },
  updateTenant: (id: string, input: UpdateTenantAdminInput) =>
    http.patch<AdminTenant>(`/admin/tenants/${id}`, input),
};
