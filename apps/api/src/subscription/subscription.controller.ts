import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { SubscriptionService } from './subscription.service.js';

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.get(user.tenantId);
  }

  @Roles(UserRole.OWNER)
  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
    @Req() request: Request,
  ) {
    const baseUrl = `${request.protocol}://${request.get('host')}`;
    return this.subscriptionService.checkout(user.tenantId, dto.plan, baseUrl);
  }

  @Roles(UserRole.OWNER)
  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    if (this.provider.name !== 'mock') {
      // Com um provedor de pagamento real configurado, a ativação só pode
      // vir do webhook autenticado do gateway — nunca de uma chamada direta
      // do cliente, que permitiria ativar um plano pago sem pagar.
      throw new ForbiddenException(
        'Confirmação manual não disponível; aguarde a confirmação do pagamento',
      );
    }
    return this.subscriptionService.activate(user.tenantId, dto.plan);
  }

  @Roles(UserRole.OWNER)
  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.cancel(user.tenantId);
  }

  @Public()
  @Post('webhook')
  webhook(
    @Body() body: unknown,
    @Headers('asaas-access-token') token?: string,
  ) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected || !token || !timingSafeEqualStrings(token, expected)) {
      // Falha fechado: sem token configurado (ou sem token/token errado na
      // requisição), a chamada é sempre recusada — nunca processada como se
      // fosse um webhook legítimo do gateway de pagamento.
      throw new UnauthorizedException('Token de webhook inválido');
    }
    return this.subscriptionService.handleWebhook(body);
  }
}
