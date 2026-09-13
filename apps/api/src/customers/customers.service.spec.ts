import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from './customers.service.js';

function createPrismaMock() {
  return {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('CustomersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CustomersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  describe('findOne', () => {
    it('lança NotFoundException quando o cliente não pertence à loja', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findOne('store-1', 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('normaliza campos opcionais vazios para null e remove espaços', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'c1' });

      await service.create('tenant-1', 'store-1', {
        name: '  João  ',
        document: '',
        phone: undefined,
        email: '  joao@example.com  ',
      } as never);

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          storeId: 'store-1',
          name: 'João',
          document: null,
          phone: null,
          email: 'joao@example.com',
        },
      });
    });
  });

  describe('update', () => {
    it('lança NotFoundException quando o cliente não existe', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update('store-1', 'inexistente', { name: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('atualiza apenas os campos informados', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.customer.update.mockResolvedValue({ id: 'c1', name: 'Novo nome' });

      await service.update('store-1', 'c1', { name: 'Novo nome' } as never);

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Novo nome' },
      });
    });
  });

  describe('remove', () => {
    it('remove o cliente quando ele pertence à loja', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });

      const result = await service.remove('store-1', 'c1');

      expect(result).toEqual({ id: 'c1' });
      expect(prisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });
  });
});
