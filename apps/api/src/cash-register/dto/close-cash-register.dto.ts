import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CloseCashRegisterDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingAmount: number;
}
