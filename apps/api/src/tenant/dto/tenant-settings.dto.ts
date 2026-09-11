import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums.js';

export class TenantSettingsDto {
  @IsOptional()
  @IsIn(['58mm', '80mm'])
  receiptWidth?: '58mm' | '80mm';

  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  defaultPaymentMethod?: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsBoolean()
  requireCustomer?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  receiptFooter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  brandColor?: string;
}
