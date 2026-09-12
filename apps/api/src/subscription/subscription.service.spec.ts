import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantPlan } from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PaymentProvider } from './payment-provider.js';
import { SubscriptionService, isSubscriptionUsable } from './subscription.service.js';

function createPrismaMock() {
  return {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

function baseTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tenant-1',
    name: 'Loja Demo',
    email: 'loja@example.com',
    document: null,
    plan: TenantPlan.FREE,
    subscriptionStatus: 'TRIAL',
    trialEndsAt: null,
    currentPeriodEnd: null,
    gatewayCustomerId: null,
    gatewaySubscriptionId: null,
    pendingPlan: null,
    ...overrides,
  };
}

describe('isSubscriptionUsable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('ACTIVE sem data de fim de período é sempre utilizável', () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: null,
      }),
    ).toBe(true);
  });

  it('ACTIVE com período vencido não é utilizável', () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toBe(false);
  });

  it('TRIAL com prazo ainda não vencido é utilizável', () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date('2026-02-01T00:00:00Z'),
        currentPeriodEnd: null,
      }),
    ).toBe(true);
  });

  it('TRIAL vencido não é utilizável', () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: null,
      }),
    ).toBe(false);
  });

  it('qualquer outro status não é utilizável', () => {
    expect(
      isSubscriptionUsable({
        subscriptionStatus: 'CANCELED',
        trialEndsAt: null,
        currentPeriodEnd: null,
      }),
    ).toBe(false);
  });
});

describe('SubscriptionService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let provider: {
    name: string;
    createCheckout: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let service: SubscriptionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: vi.fn() };
    provider = {
      name: 'mock',
      createCheckout: vi.fn(async () => ({
        provider: 'mock',
        checkoutUrl: 'https://pay.example/checkout',
        gatewaySubscriptionId: 'sub_123',
      })),
      cancel: vi.fn(async () => undefined),
    };
    service = new SubscriptionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      provider as unknown as PaymentProvider,
    );
  });

  describe('get', () => {
    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.get('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calcula os dias restantes de trial', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
      prisma.tenant.findUnique.mockResolvedValue(
        baseTenant({ trialEndsAt: new Date('2026-01-15T00:00:00Z') }),
      );

      const info = await service.get('tenant-1');

      expect(info.trialDaysLeft).toBe(5);
      expect(info.active).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('checkout', () => {
    it('rejeita checkout para um plano gratuito', async () => {
      await expect(
        service.checkout('tenant-1', TenantPlan.FREE, 'https://app.example'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando a loja não existe', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.checkout('tenant-1', TenantPlan.PRO, 'https://app.example'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria o checkout no provedor e salva o pendingPlan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue({});

      const result = await service.checkout(
        'tenant-1',
        TenantPlan.PRO,
        'https://app.example',
      );

      expect(result.checkoutUrl).toBe('https://pay.example/checkout');
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gatewaySubscriptionId: 'sub_123',
            pendingPlan: TenantPlan.PRO,
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'subscription.checkout' }),
      );
    });
  });

  describe('activate', () => {
    it('ativa a assinatura e define o novo período de 30 dias', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      prisma.tenant.update.mockResolvedValue(
        baseTenant({ plan: TenantPlan.PRO, subscriptionStatus: 'ACTIVE' }),
      );

      await service.activate('tenant-1', TenantPlan.PRO);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan: TenantPlan.PRO,
            subscriptionStatus: 'ACTIVE',
            currentPeriodEnd: new Date('2026-01-31T00:00:00Z'),
            trialEndsAt: null,
            pendingPlan: null,
          }),
        }),
      );
      vi.useRealTimers();
    });
  });

  describe('cancel', () => {
    it('cancela no provedor quando há gatewaySubscriptionId', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        baseTenant({ gatewaySubscriptionId: 'sub_123' }),
      );
      prisma.tenant.update.mockResolvedValue({});

      await service.cancel('tenant-1');

      expect(provider.cancel).toHaveBeenCalledWith('sub_123');
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { subscriptionStatus: 'CANCELED' },
        }),
      );
    });

    it('não chama o provedor quando não há assinatura no gateway', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue({});

      await service.cancel('tenant-1');

      expect(provider.cancel).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('ignora payloads sem campo event', async () => {
      const result = await service.handleWebhook({});
      expect(result).toEqual({ ok: true });
      expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
    });

    it('ativa o plano pendente quando o pagamento é confirmado', async () => {
      prisma.tenant.findFirst.mockResolvedValue(
        baseTenant({ pendingPlan: TenantPlan.PRO }),
      );
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_123' },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: TenantPlan.PRO }),
        }),
      );
    });

    it('marca a assinatura como PAST_DUE quando o pagamento está atrasado', async () => {
      prisma.tenant.findFirst.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        event: 'PAYMENT_OVERDUE',
        payment: { subscription: 'sub_123' },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { subscriptionStatus: 'PAST_DUE' },
      });
    });

    it('cancela a assinatura quando o evento indica exclusão/inativação', async () => {
      prisma.tenant.findFirst.mockResolvedValue(baseTenant());
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        event: 'SUBSCRIPTION_DELETED',
        payment: { subscription: 'sub_123' },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { subscriptionStatus: 'CANCELED' },
      });
    });

    it('ignora quando não encontra o tenant correspondente', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhook({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_desconhecido' },
      });

      expect(result).toEqual({ ok: true });
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
