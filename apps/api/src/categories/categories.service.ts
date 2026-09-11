import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    await this.ensureNameAvailable(tenantId, dto.name);
    return this.prisma.category.create({
      data: { tenantId, name: dto.name.trim() },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.findOwned(tenantId, id);
    if (dto.name) {
      await this.ensureNameAvailable(tenantId, dto.name, category.id);
    }
    return this.prisma.category.update({
      where: { id: category.id },
      data: { name: dto.name?.trim() },
    });
  }

  async remove(tenantId: string, id: string) {
    const category = await this.findOwned(tenantId, id);
    await this.prisma.category.delete({ where: { id: category.id } });
    return { id: category.id };
  }

  private async findOwned(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return category;
  }

  private async ensureNameAvailable(
    tenantId: string,
    name: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Já existe uma categoria com este nome');
    }
  }
}
