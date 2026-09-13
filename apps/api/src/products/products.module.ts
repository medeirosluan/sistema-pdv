import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [TenantModule, StockModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
