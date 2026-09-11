import { IsDateString, IsOptional } from 'class-validator';

export class QuerySalesReportDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
