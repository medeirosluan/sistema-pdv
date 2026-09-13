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
import { CreateProductDto } from './dto/create-product.dto.js';
import { ImportProductsDto } from './dto/import-products.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryProductsDto) {
    return this.productsService.list(user.tenantId, user.storeId, query);
  }

  @RequirePermission('products.view')
  @Get('export')
  exportCsv(@CurrentUser() user: AuthUser) {
    return this.productsService.exportCsv(user.tenantId, user.storeId);
  }

  @RequirePermission('products.manage')
  @Post('import')
  importCsv(@CurrentUser() user: AuthUser, @Body() dto: ImportProductsDto) {
    return this.productsService.importCsv(
      user.tenantId,
      user.storeId,
      dto.csv,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.findOne(user.tenantId, user.storeId, id);
  }

  @RequirePermission('products.manage')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.tenantId, user.storeId, dto);
  }

  @RequirePermission('products.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, user.storeId, id, dto);
  }

  @RequirePermission('products.manage')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.remove(user.tenantId, id);
  }
}
