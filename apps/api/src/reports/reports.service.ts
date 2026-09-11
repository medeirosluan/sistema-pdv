import { Injectable } from '@nestjs/common';
import { PaymentMethod, SaleStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QuerySalesReportDto } from './dto/query-sales-report.dto.js';

const CHART_DAYS = 7;

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
    createdAt: Date;
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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string): Promise<DashboardSummary> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayAgg,
      monthAgg,
      productTotal,
      productActive,
      lowStockProducts,
      customerTotal,
      recentSales,
      chartSales,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          status: SaleStatus.FINISHED,
          createdAt: { gte: startOfDay },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          status: SaleStatus.FINISHED,
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, active: true } }),
      this.prisma.product.findMany({
        where: { tenantId, active: true },
        select: { stock: true, minStock: true },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.sale.findMany({
        where: { tenantId, status: SaleStatus.FINISHED },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          total: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.sale.findMany({
        where: {
          tenantId,
          status: SaleStatus.FINISHED,
          createdAt: { gte: addDays(startOfDay, -(CHART_DAYS - 1)) },
        },
        select: { createdAt: true, total: true },
      }),
    ]);

    const todayTotal = Number(todayAgg._sum.total ?? 0);
    const monthTotal = Number(monthAgg._sum.total ?? 0);
    const monthCount = monthAgg._count;
    const productLowStock = lowStockProducts.filter(
      (product) => Number(product.stock) <= Number(product.minStock),
    ).length;

    const days = new Map<string, { total: number; count: number }>();
    for (let i = 0; i < CHART_DAYS; i += 1) {
      days.set(dateKey(addDays(startOfDay, -(CHART_DAYS - 1 - i))), {
        total: 0,
        count: 0,
      });
    }
    for (const sale of chartSales) {
      const entry = days.get(dateKey(sale.createdAt));
      if (entry) {
        entry.total += Number(sale.total);
        entry.count += 1;
      }
    }

    return {
      today: { total: round2(todayTotal), count: todayAgg._count },
      month: { total: round2(monthTotal), count: monthCount },
      averageTicket: monthCount > 0 ? round2(monthTotal / monthCount) : 0,
      products: {
        total: productTotal,
        active: productActive,
        lowStock: productLowStock,
      },
      customers: { total: customerTotal },
      recentSales: recentSales.map((sale) => ({
        ...sale,
        total: Number(sale.total),
      })),
      salesByDay: Array.from(days.entries()).map(([date, value]) => ({
        date,
        total: round2(value.total),
        count: value.count,
      })),
    };
  }

  async salesReport(
    tenantId: string,
    dto: QuerySalesReportDto,
  ): Promise<SalesReport> {
    const to = dto.to ? endOfDay(new Date(dto.to)) : new Date();
    const from = dto.from
      ? startOfDay(new Date(dto.from))
      : startOfDay(addDays(to, -29));

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: SaleStatus.FINISHED,
        createdAt: { gte: from, lte: to },
      },
      select: {
        total: true,
        discount: true,
        createdAt: true,
        payments: { select: { method: true, amount: true } },
        items: {
          select: {
            productId: true,
            description: true,
            quantity: true,
            total: true,
          },
        },
      },
    });

    let grossTotal = 0;
    let discountTotal = 0;
    let netTotal = 0;
    const paymentMap = new Map<
      PaymentMethod,
      { count: number; total: number }
    >();
    const productMap = new Map<
      string,
      {
        productId: string | null;
        description: string;
        quantity: number;
        total: number;
      }
    >();
    const dayMap = new Map<string, { total: number; count: number }>();

    for (const sale of sales) {
      grossTotal += Number(sale.total) + Number(sale.discount);
      discountTotal += Number(sale.discount);
      netTotal += Number(sale.total);

      for (const payment of sale.payments) {
        const entry = paymentMap.get(payment.method) ?? {
          count: 0,
          total: 0,
        };
        entry.count += 1;
        entry.total += Number(payment.amount);
        paymentMap.set(payment.method, entry);
      }

      for (const item of sale.items) {
        const key = item.productId ?? `custom:${item.description}`;
        const entry = productMap.get(key) ?? {
          productId: item.productId,
          description: item.description,
          quantity: 0,
          total: 0,
        };
        entry.quantity += Number(item.quantity);
        entry.total += Number(item.total);
        productMap.set(key, entry);
      }

      const key = dateKey(sale.createdAt);
      const entry = dayMap.get(key) ?? { total: 0, count: 0 };
      entry.total += Number(sale.total);
      entry.count += 1;
      dayMap.set(key, entry);
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        count: sales.length,
        grossTotal: round2(grossTotal),
        discountTotal: round2(discountTotal),
        netTotal: round2(netTotal),
        averageTicket: sales.length > 0 ? round2(netTotal / sales.length) : 0,
      },
      byPayment: Array.from(paymentMap.entries())
        .map(([method, value]) => ({
          method,
          count: value.count,
          total: round2(value.total),
        }))
        .sort((a, b) => b.total - a.total),
      byProduct: Array.from(productMap.values())
        .map((value) => ({
          ...value,
          quantity: round3(value.quantity),
          total: round2(value.total),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50),
      byDay: Array.from(dayMap.entries())
        .map(([date, value]) => ({
          date,
          total: round2(value.total),
          count: value.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
