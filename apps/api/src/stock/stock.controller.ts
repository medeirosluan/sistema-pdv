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
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { QueryStockMovementsDto } from './dto/query-stock-movements.dto.js';
import { StockService } from './stock.service.js';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermission('products.view')
  @Get('low-stock')
  lowStock(@CurrentUser() user: AuthUser) {
    return this.stockService.lowStock(user.tenantId);
  }

  @RequirePermission('products.view')
  @Get('movements')
  listMovements(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryStockMovementsDto,
  ) {
    return this.stockService.listMovements(user.tenantId, query);
  }

  @RequirePermission('products.view')
  @Get('products/:productId/movements')
  productMovements(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Query() query: QueryStockMovementsDto,
  ) {
    return this.stockService.productMovements(
      user.tenantId,
      productId,
      query,
    );
  }

  @RequirePermission('stock.manage')
  @Post('products/:productId/movements')
  registerMovement(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockService.registerMovement(
      user.tenantId,
      user.userId,
      productId,
      dto,
    );
  }
}
