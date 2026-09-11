import { http } from './api';
import type { PaymentMethod } from './sales';

export interface DashboardSummary {
  today: { total: number; count: number };
  month: { total: number; count: number };
  averageTicket: number;
  products: { total: number; active: number; lowStock: number };
  customers: { total: number };
  recentSales: {
    id: string;
    number: number;
    total: number;
    createdAt: string;
    customer: { id: string; name: string } | null;
  }[];
  salesByDay: { date: string; total: number; count: number }[];
}

export interface SalesReport {
  period: { from: string; to: string };
  totals: {
    count: number;
    grossTotal: number;
    discountTotal: number;
    netTotal: number;
    averageTicket: number;
  };
  byPayment: { method: PaymentMethod; count: number; total: number }[];
  byProduct: {
    productId: string | null;
    description: string;
    quantity: number;
    total: number;
  }[];
  byDay: { date: string; total: number; count: number }[];
}

export interface SalesReportQuery {
  from?: string;
  to?: string;
}

export const reportsApi = {
  summary: () => http.get<DashboardSummary>('/reports/summary'),
  sales: (query: SalesReportQuery = {}) => {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    const qs = params.toString();
    return http.get<SalesReport>(`/reports/sales${qs ? `?${qs}` : ''}`);
  },
};
