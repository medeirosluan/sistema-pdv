import { TenantPlan } from '../generated/prisma/enums.js';

export interface PlanDefinition {
  key: TenantPlan;
  name: string;
  price: number;
  maxUsers: number;
  maxProducts: number;
  features: string[];
}

export const PLANS: Record<TenantPlan, PlanDefinition> = {
  FREE: {
    key: TenantPlan.FREE,
    name: 'Grátis',
    price: 0,
    maxUsers: 2,
    maxProducts: 50,
    features: ['PDV completo', 'Caixa e sangria', 'Relatórios básicos'],
  },
  BASIC: {
    key: TenantPlan.BASIC,
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
  PRO: {
    key: TenantPlan.PRO,
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
};

export const PLAN_LIST: PlanDefinition[] = [
  PLANS.FREE,
  PLANS.BASIC,
  PLANS.PRO,
];
