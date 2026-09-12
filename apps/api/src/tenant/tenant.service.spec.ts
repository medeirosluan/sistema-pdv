import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantPlan } from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from './tenant.service.js';

function createPrismaMock() {
  return {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { count: vi.fn(async () => 1) },
    product: { count: vi.fn(async () => 10) },
  };
}

function baseTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tenant-1',
    name: 'Loja Demo',
    plan: TenantPlan.FREE,
    settings: { theme: 'light' },
    ...overrides,
  };
}

describe('TenantService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: TenantService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: vi.fn() };
    service = new TenantService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('get', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.get('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('faz merge das novas settings com as existentes em vez de sobrescrever', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue(baseTenant());

      await service.update(
        'tenant-1',
        { settings: { notifications: true } } as never,
        { userId: 'user-1', email: 'demo@example.com' },
      );

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            settings: { theme: 'light', notifications: true },
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.update' }),
      );
    });
  });

  describe('getPlanInfo', () => {
    it('retorna os limites e o uso atual do plano da loja', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant({ plan: TenantPlan.FREE }));
      prisma.user.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(48);

      const info = await service.getPlanInfo('tenant-1');

      expect(info.limits).toEqual({ maxUsers: 2, maxProducts: 50 });
      expect(info.usage).toEqual({ users: 2, products: 48 });
      expect(info.name).toBe('Grátis');
    });
  });

  describe('changePlan', () => {
    it('atualiza o plano e registra auditoria', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue(
        baseTenant({ plan: TenantPlan.PRO }),
      );

      const result = await service.changePlan('tenant-1', TenantPlan.PRO, {
        userId: 'user-1',
        email: 'demo@example.com',
      });

      expect(result.plan).toBe(TenantPlan.PRO);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.plan',
          metadata: { plan: TenantPlan.PRO },
        }),
      );
    });
  });
});
