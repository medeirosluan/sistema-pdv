import { IsEnum } from 'class-validator';
import { TenantPlan } from '../../generated/prisma/enums.js';

export class CheckoutDto {
  @IsEnum(TenantPlan)
  plan: TenantPlan;
}
