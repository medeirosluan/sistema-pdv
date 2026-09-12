import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  barcode?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Quando informado, este produto passa a ser uma variação (ex.: tamanho/cor) do produto referenciado. */
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  /** Rótulo da variação (ex.: "P / Azul"). Obrigatório quando parentId é informado. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  variantName?: string | null;
}
