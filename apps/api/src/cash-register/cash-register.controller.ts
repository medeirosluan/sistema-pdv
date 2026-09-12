import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CashRegisterService } from './cash-register.service.js';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto.js';
import { QueryCashRegisterDto } from './dto/query-cash-register.dto.js';

@RequirePermission('cash.operate')
@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Get()
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCashRegisterDto,
  ) {
    return this.cashRegisterService.history(user.tenantId, query);
  }

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.cashRegisterService.current(user.tenantId);
  }

  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenCashRegisterDto) {
    return this.cashRegisterService.open(user.tenantId, user.userId, dto, {
      email: user.email,
    });
  }

  @Post('close')
  close(@CurrentUser() user: AuthUser, @Body() dto: CloseCashRegisterDto) {
    return this.cashRegisterService.close(user.tenantId, dto, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Post('movements')
  addMovement(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cashRegisterService.addMovement(user.tenantId, dto, {
      userId: user.userId,
      email: user.email,
    });
  }
}
