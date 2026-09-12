import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { endOfDayLocal, startOfDayLocal } from '../common/date-range.js';
import { Prisma } from '../generated/prisma/client.js';
import { SaleStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { QuerySalesDto } from './dto/query-sales.dto.js';

const saleInclude = {
  items: true,
  payments: true,
  customer: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: QuerySalesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.SaleWhereInput = { tenantId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: startOfDayLocal(query.from) } : {}),
        ...(query.to ? { lte: endOfDayLocal(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: saleInclude,
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }
    return sale;
  }

  async create(tenantId: string, userId: string, dto: CreateSaleDto) {
    if (dto.clientId) {
      const existing = await this.prisma.sale.findFirst({
        where: { tenantId, clientId: dto.clientId },
        include: saleInclude,
      });
      if (existing) {
        return existing;
      }
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    const productIds = dto.items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    let subtotal = 0;
    const itemsData = dto.items.map((item) => {
      const product = item.productId ? productMap.get(item.productId) : undefined;
      if (item.productId && !product) {
        throw new NotFoundException(
          `Produto ${item.productId} não encontrado`,
        );
      }

      const unitPrice = item.unitPrice ?? (product ? Number(product.price) : null);
      if (unitPrice === null) {
        throw new BadRequestException(
          'Informe o preço unitário para itens sem produto',
        );
      }

      const itemDiscount = item.discount ?? 0;
      const total = round2(item.quantity * unitPrice - itemDiscount);
      subtotal = round2(subtotal + total);

      return {
        productId: product?.id ?? null,
        description: item.description ?? product?.name ?? 'Item',
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        total,
      };
    });

    const discount = dto.discount ?? 0;
    const total = round2(subtotal - discount);
    const paid = round2(
      dto.payments.reduce((sum, payment) => sum + payment.amount, 0),
    );

    if (paid < total) {
      throw new BadRequestException(
        'O valor pago é menor que o total da venda',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.sale.findFirst({
        where: { tenantId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const sale = await tx.sale.create({
        data: {
          tenantId,
          clientId: dto.clientId ?? null,
          customerId: dto.customerId ?? null,
          number,
          status: SaleStatus.FINISHED,
          subtotal,
          discount,
          total,
          createdById: userId,
          ...(dto.createdAt ? { createdAt: new Date(dto.createdAt) } : {}),
          items: { create: itemsData },
          payments: {
            create: dto.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              installments: payment.installments ?? 1,
            })),
          },
        },
        include: saleInclude,
      });

      for (const item of itemsData) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      return sale;
    });
  }

  async cancel(
    tenantId: string,
    id: string,
    actor: { userId: string; email: string },
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }
    if (sale.status === SaleStatus.CANCELED) {
      throw new ConflictException('Venda já está cancelada');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.CANCELED, canceledAt: new Date() },
        include: saleInclude,
      });

      for (const item of sale.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      await this.audit.log({
        tenantId,
        userId: actor.userId,
        userName: actor.email,
        action: 'sale.cancel',
        entity: 'Sale',
        entityId: sale.id,
        metadata: { number: sale.number, total: Number(sale.total) },
      });

      return updated;
    });
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
