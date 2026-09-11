import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { QuerySalesReportDto } from './dto/query-sales-report.dto.js';
import { ReportsService } from './reports.service.js';

@RequirePermission('reports.view')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.reportsService.summary(user.tenantId);
  }

  @Get('sales')
  sales(@CurrentUser() user: AuthUser, @Query() query: QuerySalesReportDto) {
    return this.reportsService.salesReport(user.tenantId, query);
  }
}
