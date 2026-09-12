import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { QueryCustomersDto } from './dto/query-customers.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryCustomersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CustomerWhereInput = { tenantId };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { [query.sortBy ?? 'name']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
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
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        document: dto.document?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.document !== undefined && {
          document: dto.document?.trim() || null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const customer = await this.findOne(tenantId, id);
    await this.prisma.customer.delete({ where: { id: customer.id } });
    return { id: customer.id };
  }
}
