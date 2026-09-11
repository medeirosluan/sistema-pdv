import { IsEnum } from 'class-validator';
import { TenantPlan } from '../../generated/prisma/enums.js';

export class UpdateTenantPlanDto {
  @IsEnum(TenantPlan)
  plan: TenantPlan;
}
