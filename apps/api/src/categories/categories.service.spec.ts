import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

function createPrismaMock() {
  return {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('CategoriesService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejeita nome já usado no tenant (case-insensitive)', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('tenant-1', { name: 'Bebidas' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('cria a categoria com o nome sem espaços extras', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({ id: 'c1', name: 'Bebidas' });

      await service.create('tenant-1', { name: '  Bebidas  ' } as never);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', name: 'Bebidas' },
      });
    });
  });

  describe('update', () => {
    it('lança NotFoundException quando a categoria não pertence ao tenant', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'inexistente', { name: 'Novo' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita renomear para um nome já usado por outra categoria', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({ id: 'c1', name: 'Bebidas' }) // findOwned
        .mockResolvedValueOnce({ id: 'c2' }); // ensureNameAvailable conflict

      await expect(
        service.update('tenant-1', 'c1', { name: 'Limpeza' } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('lança NotFoundException quando a categoria não existe', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove('tenant-1', 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('remove a categoria quando ela pertence ao tenant', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c1' });

      const result = await service.remove('tenant-1', 'c1');

      expect(result).toEqual({ id: 'c1' });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });
  });
});
