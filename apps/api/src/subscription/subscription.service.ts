import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { TenantPlan } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PLANS } from '../tenant/plans.js';
import {
  PAYMENT_PROVIDER,
  type CheckoutResult,
  type PaymentProvider,
} from './payment-provider.js';

const PERIOD_DAYS = 30;

export interface SubscriptionInfo {
  plan: TenantPlan;
  planName: string;
  price: number;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  trialDaysLeft: number | null;
  active: boolean;
}

export function isSubscriptionUsable(tenant: {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}): boolean {
  const now = new Date();
  if (tenant.subscriptionStatus === 'ACTIVE') {
    return !tenant.currentPeriodEnd || tenant.currentPeriodEnd > now;
  }
  if (tenant.subscriptionStatus === 'TRIAL') {
    return !tenant.trialEndsAt || tenant.trialEndsAt > now;
  }
  return false;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async get(tenantId: string): Promise<SubscriptionInfo> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada');
    }
    const definition = PLANS[tenant.plan];
    const now = new Date();
    return {
      plan: tenant.plan,
      planName: definition.name,
      price: definition.price,
      status: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: tenant.currentPeriodEnd?.toISOString() ?? null,
      trialDaysLeft: tenant.trialEndsAt
        ? daysBetween(now, tenant.trialEndsAt)
        : null,
      active: isSubscriptionUsable(tenant),
    };
  }

  async checkout(
    tenantId: string,
    plan: TenantPlan,
    baseUrl: string,
  ): Promise<CheckoutResult> {
    const definition = PLANS[plan];
    if (definition.price <= 0) {
      throw new BadRequestException('Este plano é gratuito, não precisa pagar');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada');
    }

    const result = await this.provider.createCheckout({
      tenantId,
      plan,
      price: definition.price,
      customer: {
        name: tenant.name,
        email: tenant.email ?? '',
        document: tenant.document,
      },
      existingCustomerId: tenant.gatewayCustomerId,
      successUrl: `${baseUrl}/configuracoes`,
      cancelUrl: `${baseUrl}/configuracoes`,
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        gatewaySubscriptionId: result.gatewaySubscriptionId,
        pendingPlan: plan,
        ...(result.gatewayCustomerId
          ? { gatewayCustomerId: result.gatewayCustomerId }
          : {}),
      },
    });

    await this.audit.log({
      tenantId,
      action: 'subscription.checkout',
      entity: 'Tenant',
      entityId: tenantId,
      metadata: { plan, provider: result.provider },
    });

    return result;
  }

  /**
   * Confirmação de pagamento. Em produção isso é chamado pelo webhook do
   * gateway; aqui também é exposto para simular o pagamento aprovado.
   */
  async activate(tenantId: string, plan: TenantPlan) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        subscriptionStatus: 'ACTIVE',
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        pendingPlan: null,
      },
    });

    await this.audit.log({
      tenantId,
      action: 'subscription.activated',
      entity: 'Tenant',
      entityId: tenantId,
      metadata: { plan, periodEnd: periodEnd.toISOString() },
    });

    return tenant;
  }

  async cancel(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada');
    }
    if (tenant.gatewaySubscriptionId) {
      await this.provider.cancel(tenant.gatewaySubscriptionId);
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'CANCELED' },
    });
    await this.audit.log({
      tenantId,
      action: 'subscription.canceled',
      entity: 'Tenant',
      entityId: tenantId,
    });
    return updated;
  }

  async handleWebhook(payload: unknown): Promise<{ ok: boolean }> {
    const body = payload as {
      event?: string;
      payment?: { subscription?: string; externalReference?: string };
    };
    const event = body?.event;
    if (!event) {
      return { ok: true };
    }

    const subscriptionId = body.payment?.subscription;
    const externalReference = body.payment?.externalReference;

    const tenant = subscriptionId
      ? await this.prisma.tenant.findFirst({
          where: { gatewaySubscriptionId: subscriptionId },
        })
      : externalReference
        ? await this.prisma.tenant.findUnique({
            where: { id: externalReference },
          })
        : null;

    if (!tenant) {
      return { ok: true };
    }

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const plan =
        tenant.pendingPlan ??
        (tenant.plan !== TenantPlan.FREE ? tenant.plan : null);
      if (plan) {
        await this.activate(tenant.id, plan);
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionStatus: 'PAST_DUE' },
      });
      await this.audit.log({
        tenantId: tenant.id,
        action: 'subscription.past_due',
        entity: 'Tenant',
        entityId: tenant.id,
      });
    } else if (
      event === 'SUBSCRIPTION_DELETED' ||
      event === 'SUBSCRIPTION_INACTIVATED'
    ) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionStatus: 'CANCELED' },
      });
    }

    return { ok: true };
  }
}
