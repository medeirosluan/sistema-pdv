import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TenantModule, StoresModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
