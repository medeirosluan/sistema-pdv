import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { QuerySalesDto } from './dto/query-sales.dto.js';
import { SalesService } from './sales.service.js';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @RequirePermission('reports.view')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QuerySalesDto) {
    return this.salesService.list(user.tenantId, query);
  }

  @RequirePermission('reports.view')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.findOne(user.tenantId, id);
  }

  @RequirePermission('sales.create')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.tenantId, user.userId, dto);
  }

  @RequirePermission('sales.cancel')
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.cancel(user.tenantId, id);
  }
}
