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
import { StockService } from '../stock/stock.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly stockService: StockService,
  ) {}

  async list(tenantId: string, storeId: string, query: QueryProductsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = { tenantId };
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.parentId) {
      where.parentId = query.parentId;
    } else if (query.topLevelOnly) {
      where.parentId = null;
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
        include: {
          category: true,
          _count: { select: { variants: true } },
        },
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    const stockMap = await this.stockService.getStockMap(
      storeId,
      items.map((item) => item.id),
    );

    return {
      items: items.map((item) => this.withStock(item, stockMap)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(tenantId: string, storeId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    const stockMap = await this.stockService.getStockMap(storeId, [product.id]);
    return this.withStock(product, stockMap);
  }

  async create(tenantId: string, storeId: string, dto: CreateProductDto) {
    await this.ensureCategory(tenantId, dto.categoryId);
    await this.ensureBarcodeAvailable(tenantId, dto.barcode);
    if (dto.parentId) {
      await this.ensureParent(tenantId, dto.parentId, dto.variantName);
    }

    const { limits, usage, name } =
      await this.tenantService.getPlanInfo(tenantId);
    if (usage.products >= limits.maxProducts) {
      throw new ForbiddenException(
        `Limite de ${limits.maxProducts} produto(s) do plano ${name} atingido. Faça upgrade para adicionar mais.`,
      );
    }

    const sku = dto.sku?.trim() || (await this.generateSku(tenantId));
    const barcode =
      dto.barcode?.trim() || (await this.generateBarcode(tenantId));

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        sku,
        barcode,
        price: dto.price,
        cost: dto.cost ?? null,
        unit: dto.unit?.trim() || 'UN',
        categoryId: dto.categoryId ?? null,
        active: dto.active ?? true,
        parentId: dto.parentId ?? null,
        variantName: dto.parentId ? (dto.variantName?.trim() ?? null) : null,
      },
      include: { category: true },
    });

    const stock = dto.stock ?? 0;
    const minStock = dto.minStock ?? 0;
    await this.stockService.upsertInitialStock(
      tenantId,
      storeId,
      product.id,
      stock,
      minStock,
    );

    return { ...product, stock, minStock };
  }

  async update(
    tenantId: string,
    storeId: string,
    id: string,
    dto: UpdateProductDto,
  ) {
    const product = await this.findOwned(tenantId, id);

    if (dto.categoryId !== undefined) {
      await this.ensureCategory(tenantId, dto.categoryId);
    }
    if (dto.barcode !== undefined) {
      await this.ensureBarcodeAvailable(tenantId, dto.barcode, product.id);
    }
    const nextParentId =
      dto.parentId !== undefined ? dto.parentId : product.parentId;
    if (dto.parentId !== undefined && dto.parentId !== product.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException(
          'Um produto não pode ser variação de si mesmo',
        );
      }
      if (dto.parentId) {
        await this.ensureParent(
          tenantId,
          dto.parentId,
          dto.variantName ?? product.variantName,
        );
        const childCount = await this.prisma.product.count({
          where: { parentId: id },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Este produto já tem variações e não pode virar uma variação de outro produto',
          );
        }
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.sku !== undefined && { sku: dto.sku?.trim() || null }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode?.trim() || null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.unit !== undefined && { unit: dto.unit.trim() || 'UN' }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...((dto.variantName !== undefined ||
          (dto.parentId !== undefined && !dto.parentId)) && {
          variantName: nextParentId ? dto.variantName?.trim() || null : null,
        }),
      },
      include: { category: true },
    });

    let stock: number;
    let minStock: number;
    if (dto.stock !== undefined || dto.minStock !== undefined) {
      const current = await this.stockService.getOrCreateStock(
        tenantId,
        storeId,
        product.id,
      );
      stock = dto.stock ?? Number(current.stock);
      minStock = dto.minStock ?? Number(current.minStock);
      await this.stockService.upsertInitialStock(
        tenantId,
        storeId,
        product.id,
        stock,
        minStock,
      );
    } else {
      const stockMap = await this.stockService.getStockMap(storeId, [product.id]);
      const current = stockMap.get(product.id) ?? { stock: 0, minStock: 0 };
      stock = current.stock;
      minStock = current.minStock;
    }

    return { ...updated, stock, minStock };
  }

  async remove(tenantId: string, id: string) {
    const product = await this.findOwned(tenantId, id);
    await this.prisma.product.delete({ where: { id: product.id } });
    return { id: product.id };
  }

  async exportCsv(tenantId: string, storeId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const stockMap = await this.stockService.getStockMap(
      storeId,
      products.map((product) => product.id),
    );
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
    const rows = products.map((product) => {
      const stock = stockMap.get(product.id);
      return [
        product.name,
        product.barcode ?? '',
        product.sku ?? '',
        Number(product.price).toFixed(2),
        product.cost !== null ? Number(product.cost).toFixed(2) : '',
        product.unit,
        stock?.stock ?? 0,
        stock?.minStock ?? 0,
        product.category?.name ?? '',
        product.active ? 'sim' : 'nao',
      ];
    });
    return {
      filename: `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: toCsv([header, ...rows]),
    };
  }

  async importCsv(tenantId: string, storeId: string, csv: string) {
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
        price,
        cost,
        unit,
        categoryId,
        active,
      };

      try {
        let productId: string;
        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            // uma linha sem SKU/código de barras não deve apagar o valor que o produto já tinha
            data: {
              ...data,
              ...(sku ? { sku } : {}),
              ...(barcode ? { barcode } : {}),
            },
          });
          productId = existing.id;
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
          const createdProduct = await this.prisma.product.create({
            data: {
              tenantId,
              ...data,
              sku: sku ?? (await this.generateSku(tenantId)),
              barcode: barcode ?? (await this.generateBarcode(tenantId)),
            },
          });
          productId = createdProduct.id;
          created += 1;
        }
        await this.stockService.upsertInitialStock(
          tenantId,
          storeId,
          productId,
          stock,
          minStock,
        );
      } catch {
        errors.push(`Linha ${line}: não foi possível salvar (dados duplicados?)`);
      }
    }

    return { created, updated, errors };
  }

  private withStock(
    product: { id: string } & Record<string, unknown>,
    stockMap: Map<string, { stock: number; minStock: number }>,
  ) {
    const stock = stockMap.get(product.id) ?? { stock: 0, minStock: 0 };
    return { ...product, stock: stock.stock, minStock: stock.minStock };
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

  /**
   * Gera um SKU sequencial ("SKU-000123") quando o usuário não informa um.
   * Confere disponibilidade e tenta o próximo número em caso de colisão,
   * já que sku não tem constraint de unicidade no banco (diferente do
   * barcode) e a contagem usada como base pode ficar defasada sob
   * concorrência.
   */
  private async generateSku(tenantId: string): Promise<string> {
    const base = await this.prisma.product.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = `SKU-${String(base + 1 + attempt).padStart(6, '0')}`;
      const exists = await this.prisma.product.findFirst({
        where: { tenantId, sku: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException(
      'Não foi possível gerar um SKU automático; informe um manualmente',
    );
  }

  /**
   * Gera um código de barras EAN-13 sequencial quando o usuário não informa um.
   * Usa o prefixo 20-29, reservado pela GS1 para uso interno/não varejo, com
   * dígito verificador válido, então o código pode ser impresso e escaneado
   * normalmente. Confere disponibilidade como em generateSku, já que a
   * contagem usada como base pode ficar defasada sob concorrência.
   */
  private async generateBarcode(tenantId: string): Promise<string> {
    const base = await this.prisma.product.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const body = `20${String(base + 1 + attempt).padStart(10, '0')}`;
      const candidate = `${body}${this.ean13CheckDigit(body)}`;
      const exists = await this.prisma.product.findFirst({
        where: { tenantId, barcode: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }
    throw new ConflictException(
      'Não foi possível gerar um código de barras automático; informe um manualmente',
    );
  }

  private ean13CheckDigit(body12: string): string {
    const sum = body12
      .split('')
      .reduce(
        (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
        0,
      );
    return String((10 - (sum % 10)) % 10);
  }

  private async ensureParent(
    tenantId: string,
    parentId: string,
    variantName?: string | null,
  ) {
    if (!variantName?.trim()) {
      throw new BadRequestException(
        'Informe o nome da variação (ex.: Tamanho M / Azul)',
      );
    }
    const parent = await this.prisma.product.findFirst({
      where: { id: parentId, tenantId },
    });
    if (!parent) {
      throw new NotFoundException('Produto base não encontrado');
    }
    if (parent.parentId) {
      throw new BadRequestException(
        'Uma variação não pode ser filha de outra variação',
      );
    }
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
