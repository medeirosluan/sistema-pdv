import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.validation.js';
import { CashRegisterModule } from './cash-register/cash-register.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { HealthController } from './health/health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TenantTransactionInterceptor } from './prisma/tenant-transaction.interceptor.js';
import { ProductsModule } from './products/products.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SalesModule } from './sales/sales.module.js';
import { StockModule } from './stock/stock.module.js';
import { SubscriptionModule } from './subscription/subscription.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    MailModule,
    AuthModule,
    CategoriesModule,
    CustomersModule,
    ProductsModule,
    SalesModule,
    CashRegisterModule,
    ReportsModule,
    UsersModule,
    StockModule,
    TenantModule,
    AdminModule,
    AuditModule,
    SubscriptionModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
})
export class AppModule {}
