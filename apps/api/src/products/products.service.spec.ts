import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StockService } from '../stock/stock.service.js';
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

function createStockServiceMock() {
  return {
    getStockMap: vi.fn(async () => new Map()),
    getOrCreateStock: vi.fn(async () => ({ stock: 0, minStock: 0 })),
    upsertInitialStock: vi.fn(async () => ({})),
  };
}

describe('ProductsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tenantService: { getPlanInfo: ReturnType<typeof vi.fn> };
  let stockService: ReturnType<typeof createStockServiceMock>;
  let service: ProductsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    tenantService = { getPlanInfo: vi.fn(async () => planInfo()) };
    stockService = createStockServiceMock();
    service = new ProductsService(
      prisma as unknown as PrismaService,
      tenantService as unknown as TenantService,
      stockService as unknown as StockService,
    );
  });

  describe('list', () => {
    it('filtra apenas produtos base quando topLevelOnly é informado', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.list('tenant-1', 'store-1', { topLevelOnly: true } as never);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: null }),
        }),
      );
    });

    it('filtra pelas variações de um produto específico', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.list('tenant-1', 'store-1', { parentId: 'parent-1' } as never);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentId: 'parent-1' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('rejeita código de barras já usado por outro produto', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('tenant-1', 'store-1', {
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
        service.create('tenant-1', 'store-1', { name: 'Produto X', price: 10 } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('cria o produto com valores padrão quando dentro do limite', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: '  Produto X  ',
        price: 10,
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Produto X',
            unit: 'UN',
            active: true,
          }),
        }),
      );
      expect(stockService.upsertInitialStock).toHaveBeenCalledWith(
        'tenant-1',
        'store-1',
        'p1',
        0,
        0,
      );
    });

    it('gera um SKU sequencial quando nenhum é informado', async () => {
      prisma.product.findFirst.mockResolvedValue(null); // candidato de SKU disponível
      prisma.product.count.mockResolvedValue(5);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Produto X',
        price: 10,
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sku: 'SKU-000006' }),
        }),
      );
    });

    it('tenta o próximo número quando o SKU candidato já está em uso', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'existing' }) // SKU-000001 já existe
        .mockResolvedValueOnce(null); // SKU-000002 disponível
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Produto X',
        price: 10,
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sku: 'SKU-000002' }),
        }),
      );
    });

    it('não gera SKU nem código de barras quando ambos são informados explicitamente', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Produto X',
        price: 10,
        sku: 'MEU-SKU',
        barcode: '789123',
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sku: 'MEU-SKU', barcode: '789123' }),
        }),
      );
      expect(prisma.product.count).not.toHaveBeenCalled();
    });

    it('gera um código de barras EAN-13 sequencial quando nenhum é informado', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Produto X',
        price: 10,
        sku: 'MEU-SKU',
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ barcode: '2000000000015' }),
        }),
      );
    });

    it('tenta o próximo número quando o código de barras candidato já está em uso', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'existing' }) // 2000000000015 já existe
        .mockResolvedValueOnce(null); // próximo candidato disponível
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Produto X',
        price: 10,
        sku: 'MEU-SKU',
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ barcode: '2000000000022' }),
        }),
      );
    });

    it('lança NotFoundException quando a categoria informada não existe', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'store-1', {
          name: 'Produto X',
          price: 10,
          categoryId: 'cat-inexistente',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita criar uma variação sem informar o nome da variação', async () => {
      await expect(
        service.create('tenant-1', 'store-1', {
          name: 'Camiseta',
          price: 50,
          parentId: 'parent-1',
        } as never),
      ).rejects.toThrow('Informe o nome da variação');
    });

    it('rejeita quando o produto base da variação não existe', async () => {
      prisma.product.findFirst.mockResolvedValue(null); // ensureParent

      await expect(
        service.create('tenant-1', 'store-1', {
          name: 'Camiseta',
          price: 50,
          parentId: 'parent-inexistente',
          variantName: 'P / Azul',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita quando o produto base já é, ele mesmo, uma variação', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'parent-1',
        parentId: 'avo-1',
      }); // ensureParent

      await expect(
        service.create('tenant-1', 'store-1', {
          name: 'Camiseta',
          price: 50,
          parentId: 'parent-1',
          variantName: 'P / Azul',
        } as never),
      ).rejects.toThrow('Uma variação não pode ser filha de outra variação');
    });

    it('cria a variação vinculada ao produto base', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'parent-1', parentId: null }) // ensureParent
        .mockResolvedValue(null); // generateSku: candidato de SKU disponível
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'variant-1' });

      await service.create('tenant-1', 'store-1', {
        name: 'Camiseta',
        price: 50,
        parentId: 'parent-1',
        variantName: '  P / Azul  ',
      } as never);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: 'parent-1',
            variantName: 'P / Azul',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('rejeita código de barras duplicado, ignorando o próprio produto', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'p1', tenantId: 'tenant-1' }) // findOwned
        .mockResolvedValueOnce({ id: 'p2' }); // ensureBarcodeAvailable finds a conflict

      await expect(
        service.update('tenant-1', 'store-1', 'p1', { barcode: '999' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('lança NotFoundException quando o produto não pertence ao tenant', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'store-1', 'inexistente', { name: 'Novo nome' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita transformar um produto em variação de si mesmo', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        tenantId: 'tenant-1',
        parentId: null,
      });

      await expect(
        service.update('tenant-1', 'store-1', 'p1', {
          parentId: 'p1',
          variantName: 'X',
        } as never),
      ).rejects.toThrow('não pode ser variação de si mesmo');
    });

    it('rejeita tornar variação um produto que já tem suas próprias variações', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce({ id: 'p1', tenantId: 'tenant-1', parentId: null }) // findOwned
        .mockResolvedValueOnce({ id: 'p2', parentId: null }); // ensureParent (novo pai)
      prisma.product.count.mockResolvedValue(2); // p1 já tem 2 variações

      await expect(
        service.update('tenant-1', 'store-1', 'p1', {
          parentId: 'p2',
          variantName: 'X',
        } as never),
      ).rejects.toThrow('já tem variações');
    });

    it('atualiza o nome da variação mantendo o vínculo com o produto base', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'v1',
        tenantId: 'tenant-1',
        parentId: 'parent-1',
      });
      prisma.product.update.mockResolvedValue({ id: 'v1' });

      await service.update('tenant-1', 'store-1', 'v1', {
        variantName: '  M / Preto  ',
      } as never);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ variantName: 'M / Preto' }),
        }),
      );
    });

    it('limpa o nome da variação ao desvincular o produto do pai', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'v1',
        tenantId: 'tenant-1',
        parentId: 'parent-1',
        variantName: 'M / Preto',
      });
      prisma.product.update.mockResolvedValue({ id: 'v1' });

      await service.update('tenant-1', 'store-1', 'v1', { parentId: null } as never);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: null,
            variantName: null,
          }),
        }),
      );
    });
  });

  describe('importCsv', () => {
    it('rejeita CSV vazio (sem linhas de dados)', async () => {
      await expect(service.importCsv('tenant-1', 'store-1', 'nome,preco\n')).rejects.toThrow(
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

      const result = await service.importCsv('tenant-1', 'store-1', csv);

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

      const result = await service.importCsv('tenant-1', 'store-1', csv);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-id' } }),
      );
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('gera um SKU para um produto novo quando a linha do CSV não informa um', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'created' });

      const csv = ['nome,preco', 'Produto Novo,10.00'].join('\n');
      await service.importCsv('tenant-1', 'store-1', csv);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sku: 'SKU-000001' }),
        }),
      );
    });

    it('preserva o SKU existente quando a linha de atualização não informa um', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'existing-id',
        sku: 'SKU-ANTIGO',
      });
      prisma.product.update.mockResolvedValue({ id: 'existing-id' });

      const csv = [
        'nome,preco,codigo_barras',
        'Produto Existente,20.00,789',
      ].join('\n');
      await service.importCsv('tenant-1', 'store-1', csv);

      const updateCall = prisma.product.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('sku');
    });

    it('atualiza o SKU quando a linha de atualização informa um novo valor', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'existing-id',
        sku: 'SKU-ANTIGO',
      });
      prisma.product.update.mockResolvedValue({ id: 'existing-id' });

      const csv = [
        'nome,preco,codigo_barras,sku',
        'Produto Existente,20.00,789,SKU-NOVO',
      ].join('\n');
      await service.importCsv('tenant-1', 'store-1', csv);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sku: 'SKU-NOVO' }),
        }),
      );
    });

    it('gera um código de barras para um produto novo quando a linha do CSV não informa um', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.count.mockResolvedValue(0);
      prisma.product.create.mockResolvedValue({ id: 'created' });

      const csv = ['nome,preco', 'Produto Novo,10.00'].join('\n');
      await service.importCsv('tenant-1', 'store-1', csv);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ barcode: '2000000000015' }),
        }),
      );
    });

    it('preserva o código de barras existente quando a linha de atualização não informa um', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'existing-id',
        barcode: '7891234567890',
      });
      prisma.product.update.mockResolvedValue({ id: 'existing-id' });

      const csv = ['nome,preco,sku', 'Produto Existente,20.00,SKU-X'].join('\n');
      await service.importCsv('tenant-1', 'store-1', csv);

      const updateCall = prisma.product.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('barcode');
    });

    it('para de criar novos produtos ao atingir o limite do plano, mas mantém as atualizações', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      tenantService.getPlanInfo.mockResolvedValue(
        planInfo({ maxProducts: 0, productsUsed: 0 }),
      );

      const csv = ['nome,preco', 'Produto Novo,10.00'].join('\n');
      const result = await service.importCsv('tenant-1', 'store-1', csv);

      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('limite de 0 produtos');
    });
  });
});
