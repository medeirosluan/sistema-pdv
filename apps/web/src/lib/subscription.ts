import { http } from './api';
import type { PlanKey } from './tenant';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface SubscriptionInfo {
  plan: PlanKey;
  planName: string;
  price: number;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  trialDaysLeft: number | null;
  active: boolean;
}

export interface CheckoutResponse {
  provider: string;
  checkoutUrl: string;
  gatewaySubscriptionId: string;
  gatewayCustomerId?: string;
}

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  TRIAL: 'Período de teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
};

export const subscriptionApi = {
  get: () => http.get<SubscriptionInfo>('/subscription'),
  checkout: (plan: PlanKey) =>
    http.post<CheckoutResponse>('/subscription/checkout', { plan }),
  confirm: (plan: PlanKey) =>
    http.post<{ id: string }>('/subscription/confirm', { plan }),
  cancel: () => http.post<{ id: string }>('/subscription/cancel'),
};
