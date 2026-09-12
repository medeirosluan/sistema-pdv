import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantPlan, TenantStatus } from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';

function createPrismaMock() {
  return {
    tenant: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { count: vi.fn() },
    product: { count: vi.fn() },
    sale: { count: vi.fn() },
  };
}

describe('AdminService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: AdminService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: vi.fn() };
    service = new AdminService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('summary', () => {
    it('agrega contagens globais da plataforma', async () => {
      prisma.tenant.count
        .mockResolvedValueOnce(10) // total tenants
        .mockResolvedValueOnce(8); // active tenants
      prisma.user.count.mockResolvedValue(30);
      prisma.product.count.mockResolvedValue(200);
      prisma.sale.count.mockResolvedValue(500);

      const result = await service.summary();

      expect(result).toEqual({
        tenants: 10,
        activeTenants: 8,
        users: 30,
        products: 200,
        sales: 500,
      });
    });
  });

  describe('listTenants', () => {
    it('filtra por nome ou slug quando search é informado', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ search: 'demo' } as never);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'demo', mode: 'insensitive' } },
              { slug: { contains: 'demo', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('updateTenant', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTenant(
          'inexistente',
          { plan: TenantPlan.PRO } as never,
          { userId: 'admin-1', email: 'admin@example.com' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('atualiza plano e status e registra auditoria', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.tenant.update.mockResolvedValue({
        id: 'tenant-1',
        plan: TenantPlan.PRO,
        status: TenantStatus.ACTIVE,
      });

      const result = await service.updateTenant(
        'tenant-1',
        { plan: TenantPlan.PRO, status: TenantStatus.ACTIVE } as never,
        { userId: 'admin-1', email: 'admin@example.com' },
      );

      expect(result.plan).toBe(TenantPlan.PRO);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.tenant.update' }),
      );
    });
  });
});
