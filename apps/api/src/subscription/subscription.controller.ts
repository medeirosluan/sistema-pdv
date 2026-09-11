import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { SubscriptionService } from './subscription.service.js';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

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
    @Headers('asaas-access-token') token: string,
  ) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expected && token !== expected) {
      return { ok: false };
    }
    return this.subscriptionService.handleWebhook(body);
  }
}
