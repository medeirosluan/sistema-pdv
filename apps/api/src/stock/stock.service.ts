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

  async lowStock(tenantId: string, storeId: string) {
    const stocks = await this.prisma.productStock.findMany({
      where: { tenantId, storeId, product: { active: true } },
      select: {
        stock: true,
        minStock: true,
        product: { select: { id: true, name: true, unit: true } },
      },
    });
    return stocks
      .filter((item) => Number(item.stock) <= Number(item.minStock))
      .map((item) => ({
        id: item.product.id,
        name: item.product.name,
        unit: item.product.unit,
        stock: item.stock,
        minStock: item.minStock,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listMovements(storeId: string, query: QueryStockMovementsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.StockMovementWhereInput = { storeId };
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
    storeId: string,
    productId: string,
    query: QueryStockMovementsDto,
  ) {
    await this.ensureProduct(tenantId, productId);
    return this.listMovements(storeId, { ...query, productId });
  }

  async registerMovement(
    tenantId: string,
    storeId: string,
    userId: string,
    productId: string,
    dto: CreateStockMovementDto,
  ) {
    await this.ensureProduct(tenantId, productId);
    if (
      (dto.type === StockMovementType.IN || dto.type === StockMovementType.OUT) &&
      dto.quantity <= 0
    ) {
      throw new BadRequestException('Informe uma quantidade maior que zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const stockRow = await this.getOrCreateLockedStockInTx(
        tx,
        tenantId,
        storeId,
        productId,
      );
      const previous = Number(stockRow.stock);

      let newStock: number;
      if (dto.type === StockMovementType.IN) {
        newStock = previous + dto.quantity;
      } else if (dto.type === StockMovementType.OUT) {
        newStock = previous - dto.quantity;
        if (newStock < 0) {
          throw new BadRequestException('Estoque insuficiente para esta saída');
        }
      } else {
        newStock = dto.quantity;
      }

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          storeId,
          productId,
          type: dto.type,
          quantity: dto.quantity,
          previousStock: previous,
          newStock,
          reason: dto.reason ?? null,
          createdById: userId,
        },
        include: movementInclude,
      });

      const stock = await tx.productStock.update({
        where: { storeId_productId: { storeId, productId } },
        data: { stock: newStock },
      });

      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: { category: true },
      });

      return { movement, product: { ...product, stock: stock.stock, minStock: stock.minStock } };
    });
  }

  /** Retorna a linha de estoque da loja para o produto, criando-a (zerada) se ainda não existir. */
  async getOrCreateStock(tenantId: string, storeId: string, productId: string) {
    const existing = await this.prisma.productStock.findUnique({
      where: { storeId_productId: { storeId, productId } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.productStock.create({
      data: { tenantId, storeId, productId, stock: 0, minStock: 0 },
    });
  }

  private async getOrCreateLockedStockInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    storeId: string,
    productId: string,
  ) {
    const stock = await tx.productStock.upsert({
      where: { storeId_productId: { storeId, productId } },
      update: {},
      create: { tenantId, storeId, productId, stock: 0, minStock: 0 },
    });
    await tx.$queryRaw`SELECT id FROM "ProductStock" WHERE id = ${stock.id} FOR UPDATE`;
    return tx.productStock.findUniqueOrThrow({ where: { id: stock.id } });
  }

  async getStockMap(storeId: string, productIds: string[]) {
    if (productIds.length === 0) {
      return new Map<string, { stock: number; minStock: number }>();
    }
    const rows = await this.prisma.productStock.findMany({
      where: { storeId, productId: { in: productIds } },
    });
    return new Map(
      rows.map((row) => [
        row.productId,
        { stock: Number(row.stock), minStock: Number(row.minStock) },
      ]),
    );
  }

  /** Define o estoque inicial de um produto numa loja (usado na criação/importação). */
  async upsertInitialStock(
    tenantId: string,
    storeId: string,
    productId: string,
    stock: number,
    minStock: number,
  ) {
    return this.prisma.productStock.upsert({
      where: { storeId_productId: { storeId, productId } },
      update: { stock, minStock },
      create: { tenantId, storeId, productId, stock, minStock },
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
