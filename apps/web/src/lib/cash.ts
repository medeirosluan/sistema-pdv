import { http } from './api';
import type { Paginated } from './catalog';
import type { PaymentMethod } from './sales';

export type CashRegisterStatus = 'OPEN' | 'CLOSED';
export type CashMovementType = 'WITHDRAWAL' | 'DEPOSIT';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: string | number;
  reason: string | null;
  createdAt: string;
  pending?: boolean;
}

export interface CashSummary {
  salesCount: number;
  salesTotal: number;
  byMethod: Record<PaymentMethod, number>;
  deposits: number;
  withdrawals: number;
  expectedCash: number;
}

export interface CashRegister {
  id: string;
  status: CashRegisterStatus;
  openingAmount: string | number;
  closingAmount: string | number | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: { id: string; name: string };
  movements?: CashMovement[];
  _count?: { movements: number };
}

export interface CurrentCashRegister {
  register: CashRegister & { movements: CashMovement[] };
  summary: CashSummary;
}

export interface CloseResult {
  register: CashRegister & { movements: CashMovement[] };
  summary: CashSummary;
  difference: number;
}

export interface CreateMovementInput {
  clientId?: string;
  type: CashMovementType;
  amount: number;
  reason?: string;
}

export const cashMovementLabels: Record<CashMovementType, string> = {
  WITHDRAWAL: 'Sangria',
  DEPOSIT: 'Suprimento',
};

export const cashApi = {
  current: () =>
    http.get<CurrentCashRegister | null>('/cash-register/current'),
  open: (openingAmount: number) =>
    http.post<CashRegister>('/cash-register/open', { openingAmount }),
  close: (closingAmount: number) =>
    http.post<CloseResult>('/cash-register/close', { closingAmount }),
  addMovement: (input: CreateMovementInput) =>
    http.post<CashMovement>('/cash-register/movements', input),
  history: (page = 1, pageSize = 10) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return http.get<Paginated<CashRegister>>(
      `/cash-register?${params.toString()}`,
    );
  },
};
