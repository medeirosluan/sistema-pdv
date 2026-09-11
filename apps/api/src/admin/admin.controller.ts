import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { QueryTenantsDto } from './dto/query-tenants.dto.js';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto.js';
import { PlatformAdminGuard } from './guards/platform-admin.guard.js';

@UseGuards(PlatformAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  summary() {
    return this.adminService.summary();
  }

  @Get('tenants')
  listTenants(@Query() query: QueryTenantsDto) {
    return this.adminService.listTenants(query);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantAdminDto,
  ) {
    return this.adminService.updateTenant(id, dto);
  }
}
