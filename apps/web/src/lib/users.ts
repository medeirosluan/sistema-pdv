import { http, type UserRole } from './api';
import type { Paginated } from './catalog';
import type { Permission } from './permissions';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  permissions?: Permission[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  active?: boolean;
  permissions?: Permission[];
}

export interface UserQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const usersApi = {
  list: (query: UserQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return http.get<Paginated<ManagedUser>>(`/users${qs ? `?${qs}` : ''}`);
  },
  create: (input: CreateUserInput) =>
    http.post<ManagedUser>('/users', input),
  update: (id: string, input: UpdateUserInput) =>
    http.patch<ManagedUser>(`/users/${id}`, input),
  updatePassword: (id: string, password: string) =>
    http.patch<{ id: string }>(`/users/${id}/password`, { password }),
  remove: (id: string) => http.delete<{ id: string }>(`/users/${id}`),
};
