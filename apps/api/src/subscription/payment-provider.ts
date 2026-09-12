import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TenantPlan } from '../generated/prisma/enums.js';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface CheckoutCustomer {
  name: string;
  email: string;
  document?: string | null;
}

export interface CheckoutInput {
  tenantId: string;
  plan: TenantPlan;
  price: number;
  customer: CheckoutCustomer;
  existingCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  provider: string;
  checkoutUrl: string;
  gatewaySubscriptionId: string;
  gatewayCustomerId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  cancel(gatewaySubscriptionId: string): Promise<void>;
}

/**
 * Provedor simulado para desenvolvimento (sem chave do Asaas configurada).
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const gatewaySubscriptionId = `mock_${crypto.randomUUID()}`;
    const url = new URL(input.successUrl);
    url.searchParams.set('provider', this.name);
    url.searchParams.set('plan', input.plan);
    url.searchParams.set('sub', gatewaySubscriptionId);
    return Promise.resolve({
      provider: this.name,
      checkoutUrl: url.toString(),
      gatewaySubscriptionId,
    });
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }
}

interface AsaasCustomer {
  id: string;
}

interface AsaasSubscription {
  id: string;
}

interface AsaasPayments {
  data: { invoiceUrl?: string; bankSlipUrl?: string }[];
}

/**
 * Provedor Asaas (Pix, boleto, cartão e assinaturas recorrentes).
 * Docs: https://docs.asaas.com
 */
@Injectable()
export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = 'asaas';
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ASAAS_API_KEY') ?? '';
    this.baseUrl =
      config.get<string>('ASAAS_BASE_URL') ??
      'https://api-sandbox.asaas.com/v3';
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SistemaPDV/1.0 (Node.js)',
        access_token: this.apiKey,
      },
      ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Asaas ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    let customerId = input.existingCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.request<AsaasCustomer>(
        '/customers',
        'POST',
        {
          name: input.customer.name,
          email: input.customer.email,
          cpfCnpj: input.customer.document?.replace(/\D/g, '') || undefined,
          externalReference: input.tenantId,
        },
      );
      customerId = customer.id;
    }

    const nextDueDate = new Date().toISOString().slice(0, 10);
    const subscription = await this.request<AsaasSubscription>(
      '/subscriptions',
      'POST',
      {
        customer: customerId,
        billingType: 'UNDEFINED',
        nextDueDate,
        value: input.price,
        cycle: 'MONTHLY',
        description: `Assinatura plano ${input.plan} - Sistema PDV`,
        externalReference: input.tenantId,
      },
    );

    const payments = await this.request<AsaasPayments>(
      `/subscriptions/${subscription.id}/payments`,
      'GET',
    );
    const first = payments.data?.[0];
    const checkoutUrl =
      first?.invoiceUrl ?? first?.bankSlipUrl ?? input.successUrl;

    return {
      provider: this.name,
      checkoutUrl,
      gatewaySubscriptionId: subscription.id,
      gatewayCustomerId: customerId,
    };
  }

  async cancel(gatewaySubscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${gatewaySubscriptionId}`, 'DELETE');
  }
}
