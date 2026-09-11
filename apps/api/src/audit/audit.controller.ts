import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AuditService } from './audit.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

@Roles(UserRole.OWNER, UserRole.MANAGER)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryAuditDto) {
    return this.auditService.list(user.tenantId, query);
  }
}
