import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TenantSettingsDto } from './tenant-settings.dto.js';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingsDto)
  settings?: TenantSettingsDto;
}
