import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';

function createPrismaMock() {
  return {
    sale: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
    productStock: {
      findMany: vi.fn(),
    },
    customer: {
      count: vi.fn(),
    },
  };
}

describe('ReportsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ReportsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00'));
    prisma = createPrismaMock();
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('summary', () => {
    it('calcula totais, ticket médio e contagem de estoque baixo', async () => {
      prisma.sale.aggregate
        .mockResolvedValueOnce({ _sum: { total: 100 }, _count: 2 }) // today
        .mockResolvedValueOnce({ _sum: { total: 500 }, _count: 10 }); // month
      prisma.product.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(18); // active
      prisma.productStock.findMany.mockResolvedValue([
        { stock: 10, minStock: 5 },
        { stock: 2, minStock: 5 },
        { stock: 5, minStock: 5 },
      ]);
      prisma.customer.count.mockResolvedValue(7);
      prisma.sale.findMany
        .mockResolvedValueOnce([]) // recentSales
        .mockResolvedValueOnce([]); // chartSales

      const summary = await service.summary('tenant-1', 'store-1');

      expect(summary.today).toEqual({ total: 100, count: 2 });
      expect(summary.month).toEqual({ total: 500, count: 10 });
      expect(summary.averageTicket).toBe(50);
      expect(summary.products).toEqual({
        total: 20,
        active: 18,
        lowStock: 2,
      });
      expect(summary.customers).toEqual({ total: 7 });
      expect(summary.salesByDay).toHaveLength(7);
    });

    it('retorna ticket médio zero quando não há vendas no mês', async () => {
      prisma.sale.aggregate
        .mockResolvedValueOnce({ _sum: { total: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { total: null }, _count: 0 });
      prisma.product.count.mockResolvedValue(0);
      prisma.productStock.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);
      prisma.sale.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const summary = await service.summary('tenant-1', 'store-1');

      expect(summary.averageTicket).toBe(0);
    });

    it('distribui as vendas dos últimos 7 dias no dia correto', async () => {
      prisma.sale.aggregate
        .mockResolvedValueOnce({ _sum: { total: 0 }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { total: 0 }, _count: 0 });
      prisma.product.count.mockResolvedValue(0);
      prisma.productStock.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);
      prisma.sale.findMany
        .mockResolvedValueOnce([]) // recentSales
        .mockResolvedValueOnce([
          { createdAt: new Date('2026-01-15T09:00:00'), total: 30 },
          { createdAt: new Date('2026-01-15T18:00:00'), total: 20 },
        ]);

      const summary = await service.summary('tenant-1', 'store-1');

      const today = summary.salesByDay.find((d) => d.date === '2026-01-15');
      expect(today).toEqual({ date: '2026-01-15', total: 50, count: 2 });
    });
  });

  describe('salesReport', () => {
    it('agrega totais, pagamentos e produtos corretamente', async () => {
      prisma.sale.findMany.mockResolvedValue([
        {
          total: 90,
          discount: 10,
          createdAt: new Date('2026-01-10T10:00:00'),
          payments: [{ method: PaymentMethod.CASH, amount: 90 }],
          items: [
            {
              productId: 'p1',
              description: 'Produto 1',
              quantity: 2,
              total: 60,
            },
            {
              productId: 'p1',
              description: 'Produto 1',
              quantity: 1,
              total: 30,
            },
          ],
        },
        {
          total: 50,
          discount: 0,
          createdAt: new Date('2026-01-10T15:00:00'),
          payments: [{ method: PaymentMethod.PIX, amount: 50 }],
          items: [
            {
              productId: null,
              description: 'Item avulso',
              quantity: 1,
              total: 50,
            },
          ],
        },
      ]);

      const report = await service.salesReport('store-1', {
        from: '2026-01-01',
        to: '2026-01-31',
      } as never);

      expect(report.totals).toEqual({
        count: 2,
        grossTotal: 150,
        discountTotal: 10,
        netTotal: 140,
        averageTicket: 70,
      });
      expect(report.byPayment).toEqual([
        { method: PaymentMethod.CASH, count: 1, total: 90 },
        { method: PaymentMethod.PIX, count: 1, total: 50 },
      ]);
      expect(report.byProduct).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: 'p1',
            quantity: 3,
            total: 90,
          }),
          expect.objectContaining({
            productId: null,
            description: 'Item avulso',
            quantity: 1,
            total: 50,
          }),
        ]),
      );
      expect(report.byDay).toEqual([
        { date: '2026-01-10', total: 140, count: 2 },
      ]);
    });

    it('usa período padrão dos últimos 30 dias quando from/to não são informados', async () => {
      prisma.sale.findMany.mockResolvedValue([]);

      const report = await service.salesReport('store-1', {} as never);

      const from = new Date(report.period.from);
      const to = new Date(report.period.to);
      const diffDays = Math.round(
        (to.getTime() - from.getTime()) / 86_400_000,
      );
      expect(diffDays).toBe(30);
      expect(report.totals.count).toBe(0);
      expect(report.totals.averageTicket).toBe(0);
    });
  });
});
