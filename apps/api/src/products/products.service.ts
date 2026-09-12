import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseCsv, toCsv } from '../common/csv.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async list(tenantId: string, query: QueryProductsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = { tenantId };
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
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
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    await this.ensureCategory(tenantId, dto.categoryId);
    await this.ensureBarcodeAvailable(tenantId, dto.barcode);

    const { limits, usage, name } =
      await this.tenantService.getPlanInfo(tenantId);
    if (usage.products >= limits.maxProducts) {
      throw new ForbiddenException(
        `Limite de ${limits.maxProducts} produto(s) do plano ${name} atingido. Faça upgrade para adicionar mais.`,
      );
    }

    return this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        sku: dto.sku?.trim() || null,
        barcode: dto.barcode?.trim() || null,
        price: dto.price,
        cost: dto.cost ?? null,
        unit: dto.unit?.trim() || 'UN',
        stock: dto.stock ?? 0,
        minStock: dto.minStock ?? 0,
        categoryId: dto.categoryId ?? null,
        active: dto.active ?? true,
      },
      include: { category: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.findOwned(tenantId, id);

    if (dto.categoryId !== undefined) {
      await this.ensureCategory(tenantId, dto.categoryId);
    }
    if (dto.barcode !== undefined) {
      await this.ensureBarcodeAvailable(tenantId, dto.barcode, product.id);
    }

    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.sku !== undefined && { sku: dto.sku?.trim() || null }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode?.trim() || null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.unit !== undefined && { unit: dto.unit.trim() || 'UN' }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: { category: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const product = await this.findOwned(tenantId, id);
    await this.prisma.product.delete({ where: { id: product.id } });
    return { id: product.id };
  }

  async exportCsv(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const header = [
      'nome',
      'codigo_barras',
      'sku',
      'preco',
      'custo',
      'unidade',
      'estoque',
      'estoque_minimo',
      'categoria',
      'ativo',
    ];
    const rows = products.map((product) => [
      product.name,
      product.barcode ?? '',
      product.sku ?? '',
      Number(product.price).toFixed(2),
      product.cost !== null ? Number(product.cost).toFixed(2) : '',
      product.unit,
      Number(product.stock),
      Number(product.minStock),
      product.category?.name ?? '',
      product.active ? 'sim' : 'nao',
    ]);
    return {
      filename: `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: toCsv([header, ...rows]),
    };
  }

  async importCsv(tenantId: string, csv: string) {
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      throw new BadRequestException('CSV vazio ou sem linhas de dados');
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const value = (row: string[], name: string) => {
      const index = col(name);
      return index >= 0 ? (row[index] ?? '').trim() : '';
    };

    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r];
      const line = r + 1;
      const name = value(row, 'nome');
      const price = Number(value(row, 'preco').replace(',', '.'));
      if (!name) {
        errors.push(`Linha ${line}: nome é obrigatório`);
        continue;
      }
      if (!Number.isFinite(price) || price < 0) {
        errors.push(`Linha ${line}: preço inválido`);
        continue;
      }

      const barcode = value(row, 'codigo_barras') || null;
      const sku = value(row, 'sku') || null;
      const costRaw = value(row, 'custo').replace(',', '.');
      const cost = costRaw ? Number(costRaw) : null;
      const unit = value(row, 'unidade') || 'UN';
      const stockRaw = value(row, 'estoque').replace(',', '.');
      const stock = stockRaw ? Number(stockRaw) : 0;
      const minRaw = value(row, 'estoque_minimo').replace(',', '.');
      const minStock = minRaw ? Number(minRaw) : 0;
      const categoryName = value(row, 'categoria');
      const activeRaw = value(row, 'ativo').toLowerCase();
      const active =
        activeRaw === ''
          ? true
          : !['nao', 'não', 'false', '0'].includes(activeRaw);

      const categoryId = categoryName
        ? await this.ensureCategoryByName(tenantId, categoryName)
        : null;

      const existing = barcode
        ? await this.prisma.product.findFirst({ where: { tenantId, barcode } })
        : sku
          ? await this.prisma.product.findFirst({ where: { tenantId, sku } })
          : await this.prisma.product.findFirst({ where: { tenantId, name } });

      const data = {
        name,
        barcode,
        sku,
        price,
        cost,
        unit,
        stock,
        minStock,
        categoryId,
        active,
      };

      try {
        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          const { limits, usage, name: planName } =
            await this.tenantService.getPlanInfo(tenantId);
          if (usage.products + created >= limits.maxProducts) {
            errors.push(
              `Linha ${line}: limite de ${limits.maxProducts} produtos do plano ${planName} atingido`,
            );
            continue;
          }
          await this.prisma.product.create({ data: { tenantId, ...data } });
          created += 1;
        }
      } catch {
        errors.push(`Linha ${line}: não foi possível salvar (dados duplicados?)`);
      }
    }

    return { created, updated, errors };
  }

  private async ensureCategoryByName(tenantId: string, name: string) {
    const existing = await this.prisma.category.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return existing.id;
    }
    const created = await this.prisma.category.create({
      data: { tenantId, name },
    });
    return created.id;
  }

  private async findOwned(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  private async ensureCategory(tenantId: string, categoryId?: string | null) {
    if (!categoryId) {
      return;
    }
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
  }

  private async ensureBarcodeAvailable(
    tenantId: string,
    barcode?: string | null,
    ignoreId?: string,
  ) {
    const value = barcode?.trim();
    if (!value) {
      return;
    }
    const existing = await this.prisma.product.findFirst({
      where: {
        tenantId,
        barcode: value,
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe um produto com este código de barras',
      );
    }
  }
}
