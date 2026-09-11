import { IsEnum, IsOptional } from 'class-validator';
import {
  TenantPlan,
  TenantStatus,
} from '../../generated/prisma/enums.js';

export class UpdateTenantAdminDto {
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
