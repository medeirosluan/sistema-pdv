import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums.js';

export class CreateStockMovementDto {
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
