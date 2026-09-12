import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TenantService } from '../tenant/tenant.service.js';
import { ProductsService } from './products.service.js';

function createPrismaMock() {
  return {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
}

function planInfo(overrides: Partial<{ maxProducts: number; productsUsed: number }> = {}) {
  return {
    plan: 'FREE',
    name: 'Grátis',
    price: 0,
    features: [],
    limits: { maxUsers: 1, maxProducts: overrides.maxProducts ?? 100 },
    usage: { users: 1, products: overrides.productsUsed ?? 0 },
  };
}

describe('ProductsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tenantService: { getPlanInfo: ReturnType<typeof vi.fn> };
  let service: ProductsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    tenantService = { getPlanInfo: vi.fn(async () => planInfo()) };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      tenantService as unknown as TenantService,
    );
  });

  describe('create', () => {
    it('rejeita código de barras já usado por outro produto', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('tenant-1', {
          name: 'Produto X',
          price: 10,
          barcode: '123',
        } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita quando o limite de produtos do plano foi atingido', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      tenantService.getPlanInfo.mockResolvedValue(
        planInfo({ maxProducts: 5, productsUsed: 5 }),
      );

      await expect(
        service.create('tenant-1', { name: 'Produto X', price: 10 } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('cria o produto com valores padrão quando dentro do limite', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', {
        name: '  Produto X  ',
        price: 10,
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Produto X',
            unit: 'UN',
            stock: 0,
            minStock: 0,
            active: true,
          }),
        }),
      );
    });

    it('lança NotFoundException quando a categoria informada não existe', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', {
          name: 'Produto X',
          price: 10,
          categoryId: 'cat-inexistente',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejeita código de barras duplicado, ignorando o próprio produto', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'p1', tenantId: 'tenant-1' }) // findOwned
        .mockResolvedValueOnce({ id: 'p2' }); // ensureBarcodeAvailable finds a conflict

      await expect(
        service.update('tenant-1', 'p1', { barcode: '999' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('lança NotFoundException quando o produto não pertence ao tenant', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'inexistente', { name: 'Novo nome' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('importCsv', () => {
    it('rejeita CSV vazio (sem linhas de dados)', async () => {
      await expect(service.importCsv('tenant-1', 'nome,preco\n')).rejects.toThrow(
        'CSV vazio ou sem linhas de dados',
      );
    });

    it('reporta erro de linha para nome ausente e preço inválido, sem interromper o restante', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'created' });

      const csv = [
        'nome,preco',
        ',10.00',
        'Produto Válido,abc',
        'Produto OK,15.50',
      ].join('\n');

      const result = await service.importCsv('tenant-1', csv);

      expect(result.errors).toEqual([
        'Linha 2: nome é obrigatório',
        'Linha 3: preço inválido',
      ]);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('atualiza produto existente identificado por código de barras', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing-id' });
      prisma.product.update.mockResolvedValue({ id: 'existing-id' });

      const csv = [
        'nome,preco,codigo_barras',
        'Produto Existente,20.00,789',
      ].join('\n');

      const result = await service.importCsv('tenant-1', csv);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-id' } }),
      );
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('para de criar novos produtos ao atingir o limite do plano, mas mantém as atualizações', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      tenantService.getPlanInfo.mockResolvedValue(
        planInfo({ maxProducts: 0, productsUsed: 0 }),
      );

      const csv = ['nome,preco', 'Produto Novo,10.00'].join('\n');
      const result = await service.importCsv('tenant-1', csv);

      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('limite de 0 produtos');
    });
  });
});
