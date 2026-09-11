import { http } from './api';
import type { Paginated } from './catalog';

export interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  entity?: string;
  action?: string;
}

export const auditApi = {
  list: (query: AuditQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.entity) params.set('entity', query.entity);
    if (query.action) params.set('action', query.action);
    const qs = params.toString();
    return http.get<Paginated<AuditLog>>(`/audit${qs ? `?${qs}` : ''}`);
  },
};
