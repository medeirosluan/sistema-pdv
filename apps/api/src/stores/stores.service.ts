import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.store.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, tenantId } });
    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }
    return store;
  }

  /** Confere que a loja pertence ao tenant, usado ao vincular usuários a uma loja. */
  async ensureBelongsToTenant(tenantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, tenantId },
    });
    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }
    return store;
  }

  async create(tenantId: string, dto: CreateStoreDto) {
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.store.findFirst({
      where: { tenantId, slug },
    });
    if (existing) {
      throw new ConflictException('Já existe uma loja com este identificador');
    }
    return this.prisma.store.create({
      data: { tenantId, name: dto.name.trim(), slug },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateStoreDto) {
    const store = await this.findOne(tenantId, id);
    return this.prisma.store.update({
      where: { id: store.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }
}
