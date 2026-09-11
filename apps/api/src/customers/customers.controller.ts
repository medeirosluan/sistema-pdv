import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { QueryCustomersDto } from './dto/query-customers.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryCustomersDto) {
    return this.customersService.list(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @RequirePermission('customers.manage')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @RequirePermission('customers.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @RequirePermission('customers.manage')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customersService.remove(user.tenantId, id);
  }
}
