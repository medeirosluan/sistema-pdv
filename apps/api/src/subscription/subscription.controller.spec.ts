import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantPlan } from '../generated/prisma/enums.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import type { PaymentProvider } from './payment-provider.js';
import { SubscriptionController } from './subscription.controller.js';
import type { SubscriptionService } from './subscription.service.js';

function actor(): AuthUser {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'owner@example.com',
    role: 'OWNER' as never,
    permissions: [] as never,
  };
}

describe('SubscriptionController', () => {
  let subscriptionService: { activate: ReturnType<typeof vi.fn> };
  let provider: { name: string };

  beforeEach(() => {
    subscriptionService = { activate: vi.fn(async () => ({})) };
  });

  afterEach(() => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
  });

  describe('confirm', () => {
    it('ativa o plano quando o provedor é o mock (ambiente de demonstração)', async () => {
      provider = { name: 'mock' };
      const controller = new SubscriptionController(
        subscriptionService as unknown as SubscriptionService,
        provider as unknown as PaymentProvider,
      );

      await controller.confirm(actor(), { plan: TenantPlan.PRO } as never);

      expect(subscriptionService.activate).toHaveBeenCalledWith(
        'tenant-1',
        TenantPlan.PRO,
      );
    });

    it('rejeita a confirmação manual quando um provedor de pagamento real está configurado', async () => {
      provider = { name: 'asaas' };
      const controller = new SubscriptionController(
        subscriptionService as unknown as SubscriptionService,
        provider as unknown as PaymentProvider,
      );

      expect(() =>
        controller.confirm(actor(), { plan: TenantPlan.PRO } as never),
      ).toThrow(ForbiddenException);
      expect(subscriptionService.activate).not.toHaveBeenCalled();
    });
  });

  describe('webhook', () => {
    function controllerWithMockProvider() {
      return new SubscriptionController(
        subscriptionService as unknown as SubscriptionService,
        { name: 'mock' } as unknown as PaymentProvider,
      );
    }

    it('rejeita quando ASAAS_WEBHOOK_TOKEN não está configurado, mesmo sem token na requisição', () => {
      delete process.env.ASAAS_WEBHOOK_TOKEN;
      const controller = controllerWithMockProvider();

      expect(() => controller.webhook({ event: 'PAYMENT_CONFIRMED' })).toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita quando o token enviado não confere com o configurado', () => {
      process.env.ASAAS_WEBHOOK_TOKEN = 'segredo-correto';
      const controller = controllerWithMockProvider();

      expect(() =>
        controller.webhook({ event: 'PAYMENT_CONFIRMED' }, 'token-errado'),
      ).toThrow(UnauthorizedException);
    });

    it('processa o evento quando o token confere', () => {
      process.env.ASAAS_WEBHOOK_TOKEN = 'segredo-correto';
      const controller = controllerWithMockProvider();
      const handleWebhookSpy = vi
        .fn()
        .mockResolvedValue({ ok: true }) as unknown as SubscriptionService['handleWebhook'];
      (subscriptionService as unknown as SubscriptionService).handleWebhook =
        handleWebhookSpy;

      controller.webhook({ event: 'PAYMENT_CONFIRMED' }, 'segredo-correto');

      expect(handleWebhookSpy).toHaveBeenCalledWith({
        event: 'PAYMENT_CONFIRMED',
      });
    });
  });
});
