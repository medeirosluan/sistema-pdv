import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsaasPaymentProvider,
  MockPaymentProvider,
  PAYMENT_PROVIDER,
} from './payment-provider.js';
import { SubscriptionController } from './subscription.controller.js';
import { SubscriptionService } from './subscription.service.js';

@Module({
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('ASAAS_API_KEY')
          ? new AsaasPaymentProvider(config)
          : new MockPaymentProvider(),
    },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
