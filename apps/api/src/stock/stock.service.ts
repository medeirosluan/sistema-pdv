import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { QueryStockMovementsDto } from './dto/query-stock-movements.dto.js';

const movementInclude = {
  product: { select: { id: true, name: true, unit: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.StockMovementInclude;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async lowStock(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        name: true,
        unit: true,
        stock: true,
        minStock: true,
      },
      orderBy: { name: 'asc' },
    });
    return products.filter(
      (product) => Number(product.stock) <= Number(product.minStock),
    );
  }

  async listMovements(tenantId: string, query: QueryStockMovementsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.StockMovementWhereInput = { tenantId };
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async productMovements(
    tenantId: string,
    productId: string,
    query: QueryStockMovementsDto,
  ) {
    await this.ensureProduct(tenantId, productId);
    return this.listMovements(tenantId, { ...query, productId });
  }

  async registerMovement(
    tenantId: string,
    userId: string,
    productId: string,
    dto: CreateStockMovementDto,
  ) {
    const product = await this.ensureProduct(tenantId, productId);
    const previous = Number(product.stock);

    let newStock: number;
    if (dto.type === StockMovementType.IN) {
      if (dto.quantity <= 0) {
        throw new BadRequestException('Informe uma quantidade maior que zero');
      }
      newStock = previous + dto.quantity;
    } else if (dto.type === StockMovementType.OUT) {
      if (dto.quantity <= 0) {
        throw new BadRequestException('Informe uma quantidade maior que zero');
      }
      newStock = previous - dto.quantity;
      if (newStock < 0) {
        throw new BadRequestException('Estoque insuficiente para esta saída');
      }
    } else {
      newStock = dto.quantity;
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          previousStock: previous,
          newStock,
          reason: dto.reason ?? null,
          createdById: userId,
        },
        include: movementInclude,
      });

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
        include: { category: true },
      });

      return { movement, product: updated };
    });
  }

  private async ensureProduct(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }
}
