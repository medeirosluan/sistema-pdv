import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CashMovementType } from '../../generated/prisma/enums.js';

export class CreateCashMovementDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsEnum(CashMovementType)
  type: CashMovementType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
