import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

export interface AuditEntry {
  tenantId?: string | null;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId ?? null,
          userId: entry.userId ?? null,
          userName: entry.userName ?? null,
          action: entry.action,
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
        },
      });
    } catch {
      // auditoria nunca deve quebrar o fluxo principal
    }
  }

  async list(tenantId: string, query: QueryAuditDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (query.entity) {
      where.entity = query.entity;
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
