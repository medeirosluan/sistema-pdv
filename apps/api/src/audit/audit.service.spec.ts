import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

function createPrismaMock() {
  return {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('AuditService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AuditService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuditService(prisma as unknown as PrismaService);
  });

  describe('log', () => {
    it('grava a entrada com os valores padrão para campos ausentes', async () => {
      prisma.auditLog.create.mockResolvedValue({});

      await service.log({ action: 'sale.create' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: null,
          userId: null,
          userName: null,
          action: 'sale.create',
          entity: null,
          entityId: null,
          metadata: {},
          ip: null,
        },
      });
    });

    it('nunca lança erro, mesmo se a gravação falhar', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.log({ action: 'sale.create' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('filtra por entidade e por ação (contains, case-insensitive)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.list('tenant-1', {
        entity: 'Sale',
        action: 'cancel',
      } as never);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            entity: 'Sale',
            action: { contains: 'cancel', mode: 'insensitive' },
          },
        }),
      );
    });

    it('pagina os resultados corretamente', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: '1' }]);
      prisma.auditLog.count.mockResolvedValue(41);

      const result = await service.list('tenant-1', {
        page: 2,
        pageSize: 20,
      } as never);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.totalPages).toBe(3);
    });
  });
});
