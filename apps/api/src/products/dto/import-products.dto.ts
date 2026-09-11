import { IsString, MinLength } from 'class-validator';

export class ImportProductsDto {
  @IsString()
  @MinLength(1)
  csv: string;
}
