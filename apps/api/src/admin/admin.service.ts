import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { TenantStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryTenantsDto } from './dto/query-tenants.dto.js';
import { UpdateTenantAdminDto } from './dto/update-tenant-admin.dto.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [tenants, activeTenants, users, products, sales] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
        this.prisma.user.count(),
        this.prisma.product.count(),
        this.prisma.sale.count(),
      ]);

    return { tenants, activeTenants, users, products, sales };
  }

  async listTenants(query: QueryTenantsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.TenantWhereInput = {};
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          _count: { select: { users: true, products: true, sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async updateTenant(id: string, dto: UpdateTenantAdminDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada');
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.plan !== undefined && { plan: dto.plan }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }
}
