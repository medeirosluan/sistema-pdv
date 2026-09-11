import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums.js';

export class QueryStockMovementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}
