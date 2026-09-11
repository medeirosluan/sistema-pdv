import { http, type TenantInfo, type TenantSettings } from './api';

export type PlanKey = 'FREE' | 'BASIC' | 'PRO';

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  price: number;
  maxUsers: number;
  maxProducts: number;
  features: string[];
}

export interface PlanInfo {
  plan: PlanKey;
  name: string;
  price: number;
  features: string[];
  limits: { maxUsers: number; maxProducts: number };
  usage: { users: number; products: number };
}

export const PLANS: PlanDefinition[] = [
  {
    key: 'FREE',
    name: 'Grátis',
    price: 0,
    maxUsers: 2,
    maxProducts: 50,
    features: ['PDV completo', 'Caixa e sangria', 'Relatórios básicos'],
  },
  {
    key: 'BASIC',
    name: 'Básico',
    price: 49.9,
    maxUsers: 5,
    maxProducts: 500,
    features: [
      'Tudo do Grátis',
      'Até 5 usuários',
      'Até 500 produtos',
      'Impressão de cupom',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 99.9,
    maxUsers: 20,
    maxProducts: 5000,
    features: [
      'Tudo do Básico',
      'Até 20 usuários',
      'Até 5.000 produtos',
      'Relatórios avançados',
    ],
  },
];

export interface UpdateTenantInput {
  name?: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  settings?: TenantSettings;
}

export const tenantApi = {
  get: () => http.get<TenantInfo>('/tenant'),
  update: (input: UpdateTenantInput) => http.patch<TenantInfo>('/tenant', input),
  plan: () => http.get<PlanInfo>('/tenant/plan'),
  changePlan: (plan: PlanKey) => http.patch<TenantInfo>('/tenant/plan', { plan }),
};
