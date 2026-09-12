import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { TenantPlan } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { PLANS } from './plans.js';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada');
    }
    return tenant;
  }

  async update(
    tenantId: string,
    dto: UpdateTenantDto,
    actor: { userId: string; email: string },
  ) {
    const tenant = await this.get(tenantId);
    const currentSettings =
      (tenant.settings as Record<string, unknown> | null) ?? {};

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.document !== undefined && {
          document: dto.document?.trim() || null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.address !== undefined && {
          address: dto.address?.trim() || null,
        }),
        ...(dto.settings !== undefined && {
          settings: { ...currentSettings, ...dto.settings },
        }),
      },
    });
    await this.auditUpdate(tenantId, Object.keys(dto), actor);
    return updated;
  }

  private async auditUpdate(
    tenantId: string,
    changes: string[],
    actor: { userId: string; email: string },
  ) {
    await this.audit.log({
      tenantId,
      userId: actor.userId,
      userName: actor.email,
      action: 'tenant.update',
      entity: 'Tenant',
      entityId: tenantId,
      metadata: { changes },
    });
  }

  async getPlanInfo(tenantId: string) {
    const tenant = await this.get(tenantId);
    const definition = PLANS[tenant.plan];

    const [users, products] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, active: true } }),
      this.prisma.product.count({ where: { tenantId } }),
    ]);

    return {
      plan: tenant.plan,
      name: definition.name,
      price: definition.price,
      features: definition.features,
      limits: {
        maxUsers: definition.maxUsers,
        maxProducts: definition.maxProducts,
      },
      usage: { users, products },
    };
  }

  async changePlan(
    tenantId: string,
    plan: TenantPlan,
    actor: { userId: string; email: string },
  ) {
    await this.get(tenantId);
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });
    await this.audit.log({
      tenantId,
      userId: actor.userId,
      userName: actor.email,
      action: 'tenant.plan',
      entity: 'Tenant',
      entityId: tenantId,
      metadata: { plan },
    });
    return tenant;
  }
}
