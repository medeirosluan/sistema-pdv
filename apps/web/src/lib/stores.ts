import { http } from './api';

export interface Store {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreInput {
  name: string;
  slug: string;
}

export const storesApi = {
  list: () => http.get<Store[]>('/stores'),
  create: (input: StoreInput) => http.post<Store>('/stores', input),
  update: (id: string, input: Partial<{ name: string; active: boolean }>) =>
    http.patch<Store>(`/stores/${id}`, input),
};
