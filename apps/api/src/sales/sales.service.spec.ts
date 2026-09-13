import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod, SaleStatus, StockMovementType } from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SalesService } from './sales.service.js';

function createTxMock() {
  return {
    sale: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    productStock: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  };
}

function createPrismaMock(tx: ReturnType<typeof createTxMock>) {
  return {
    sale: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    cashRegister: {
      findFirst: vi.fn().mockResolvedValue({ id: 'register-1', status: 'OPEN' }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  };
}

describe('SalesService', () => {
  let tx: ReturnType<typeof createTxMock>;
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: SalesService;

  beforeEach(() => {
    tx = createTxMock();
    prisma = createPrismaMock(tx);
    audit = { log: vi.fn() };
    service = new SalesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('gera um StockMovement OUT para cada item vinculado a produto', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', price: 10, name: 'Produto 1' },
      ]);
      tx.sale.create.mockResolvedValue({
        id: 'sale-1',
        number: 1,
        items: [],
        payments: [],
      });
      tx.productStock.findUnique.mockResolvedValue({ id: 'ps-1', stock: 6, minStock: 0 });
      tx.productStock.update.mockResolvedValue({ id: 'ps-1', stock: 4 });

      await service.create('tenant-1', 'store-1', 'user-1', {
        items: [{ productId: 'prod-1', quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: 20 }],
      } as never);

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            storeId: 'store-1',
            productId: 'prod-1',
            type: StockMovementType.OUT,
            quantity: 2,
            previousStock: 6,
            newStock: 4,
            createdById: 'user-1',
          }),
        }),
      );
    });

    it('não gera StockMovement para itens sem produto vinculado', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      tx.sale.create.mockResolvedValue({
        id: 'sale-1',
        number: 1,
        items: [],
        payments: [],
      });

      await service.create('tenant-1', 'store-1', 'user-1', {
        items: [{ description: 'Item avulso', quantity: 1, unitPrice: 15 }],
        payments: [{ method: PaymentMethod.CASH, amount: 15 }],
      } as never);

      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      expect(tx.productStock.update).not.toHaveBeenCalled();
    });

    it('recusa a venda quando não há caixa aberto', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'store-1', 'user-1', {
          items: [{ description: 'Item avulso', quantity: 1, unitPrice: 15 }],
          payments: [{ method: PaymentMethod.CASH, amount: 15 }],
        } as never),
      ).rejects.toThrow('Abra o caixa antes de registrar uma venda');

      expect(tx.sale.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('gera um StockMovement IN para cada item da venda cancelada', async () => {
      prisma.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        tenantId: 'tenant-1',
        number: 7,
        status: SaleStatus.FINISHED,
        items: [{ productId: 'prod-1', quantity: 3 }],
      });
      tx.sale.update.mockResolvedValue({ id: 'sale-1' });
      tx.productStock.findUnique.mockResolvedValue({ id: 'ps-1', stock: 10, minStock: 0 });
      tx.productStock.update.mockResolvedValue({ id: 'ps-1', stock: 13 });

      await service.cancel('store-1', 'sale-1', {
        userId: 'user-1',
        email: 'user@example.com',
      });

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            type: StockMovementType.IN,
            quantity: 3,
            previousStock: 10,
            newStock: 13,
            reason: 'Cancelamento da venda #7',
          }),
        }),
      );
    });
  });
});
