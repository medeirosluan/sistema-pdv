import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { UserRole } from '../generated/prisma/enums.js';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { TenantService } from './tenant.service.js';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.tenantService.get(user.tenantId);
  }

  @Get('plan')
  getPlan(@CurrentUser() user: AuthUser) {
    return this.tenantService.getPlanInfo(user.tenantId);
  }

  @RequirePermission('settings.manage')
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(user.tenantId, dto);
  }

  @Roles(UserRole.OWNER)
  @Patch('plan')
  changePlan(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTenantPlanDto,
  ) {
    return this.tenantService.changePlan(user.tenantId, dto.plan);
  }
}
