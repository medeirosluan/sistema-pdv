import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockMovementType } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from './stock.service.js';

function createPrismaMock() {
  const prisma = {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

describe('StockService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: StockService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StockService(prisma as unknown as PrismaService);
  });

  describe('lowStock', () => {
    it('retorna apenas produtos com estoque igual ou abaixo do mínimo', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: '1', name: 'Acima', unit: 'un', stock: 10, minStock: 5 },
        { id: '2', name: 'No limite', unit: 'un', stock: 5, minStock: 5 },
        { id: '3', name: 'Abaixo', unit: 'un', stock: 2, minStock: 5 },
      ]);

      const result = await service.lowStock('tenant-1');

      expect(result.map((product) => product.id)).toEqual(['2', '3']);
    });
  });

  describe('registerMovement', () => {
    it('IN soma a quantidade ao estoque atual', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', stock: 10 });
      prisma.stockMovement.create.mockResolvedValue({});
      prisma.product.update.mockResolvedValue({ id: 'p1', stock: 15 });

      await service.registerMovement('tenant-1', 'user-1', 'p1', {
        type: StockMovementType.IN,
        quantity: 5,
      });

      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStock: 10,
            newStock: 15,
          }),
        }),
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 15 } }),
      );
    });

    it('OUT subtrai a quantidade do estoque atual', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', stock: 10 });
      prisma.stockMovement.create.mockResolvedValue({});
      prisma.product.update.mockResolvedValue({ id: 'p1', stock: 4 });

      await service.registerMovement('tenant-1', 'user-1', 'p1', {
        type: StockMovementType.OUT,
        quantity: 6,
      });

      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStock: 10,
            newStock: 4,
          }),
        }),
      );
    });

    it('OUT rejeita quando a quantidade excede o estoque disponível', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', stock: 3 });

      await expect(
        service.registerMovement('tenant-1', 'user-1', 'p1', {
          type: StockMovementType.OUT,
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('ADJUST define o estoque diretamente para a quantidade informada', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', stock: 10 });
      prisma.stockMovement.create.mockResolvedValue({});
      prisma.product.update.mockResolvedValue({ id: 'p1', stock: 7 });

      await service.registerMovement('tenant-1', 'user-1', 'p1', {
        type: StockMovementType.ADJUST,
        quantity: 7,
      });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 7 } }),
      );
    });

    it('rejeita quantidade zero ou negativa para IN e OUT', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', stock: 10 });

      await expect(
        service.registerMovement('tenant-1', 'user-1', 'p1', {
          type: StockMovementType.IN,
          quantity: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.registerMovement('tenant-1', 'user-1', 'inexistente', {
          type: StockMovementType.IN,
          quantity: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
