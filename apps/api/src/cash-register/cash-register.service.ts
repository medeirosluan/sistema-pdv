import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  CashMovementType,
  CashRegisterStatus,
  PaymentMethod,
  SaleStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto.js';
import { QueryCashRegisterDto } from './dto/query-cash-register.dto.js';

export interface CashSummary {
  salesCount: number;
  salesTotal: number;
  byMethod: Record<PaymentMethod, number>;
  deposits: number;
  withdrawals: number;
  expectedCash: number;
}

const registerInclude = {
  openedBy: { select: { id: true, name: true } },
  movements: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CashRegisterInclude;

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  async open(tenantId: string, userId: string, dto: OpenCashRegisterDto) {
    const existing = await this.findOpen(tenantId);
    if (existing) {
      throw new ConflictException('Já existe um caixa aberto');
    }
    return this.prisma.cashRegister.create({
      data: {
        tenantId,
        openedById: userId,
        openingAmount: dto.openingAmount,
        status: CashRegisterStatus.OPEN,
      },
      include: registerInclude,
    });
  }

  async current(tenantId: string) {
    const register = await this.findOpenDetailed(tenantId);
    if (!register) {
      return null;
    }
    const summary = await this.buildSummary(
      tenantId,
      register.openedAt,
      null,
      register.movements,
      Number(register.openingAmount),
    );
    return { register, summary };
  }

  async close(tenantId: string, dto: CloseCashRegisterDto) {
    const register = await this.findOpenDetailed(tenantId);
    if (!register) {
      throw new NotFoundException('Nenhum caixa aberto');
    }

    const closedAt = new Date();
    const summary = await this.buildSummary(
      tenantId,
      register.openedAt,
      closedAt,
      register.movements,
      Number(register.openingAmount),
    );

    const updated = await this.prisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: CashRegisterStatus.CLOSED,
        closingAmount: dto.closingAmount,
        closedAt,
      },
      include: registerInclude,
    });

    return {
      register: updated,
      summary,
      difference: round2(dto.closingAmount - summary.expectedCash),
    };
  }

  async addMovement(tenantId: string, dto: CreateCashMovementDto) {
    if (dto.clientId) {
      const existing = await this.prisma.cashMovement.findUnique({
        where: { clientId: dto.clientId },
        include: { cashRegister: { select: { tenantId: true } } },
      });
      if (existing && existing.cashRegister.tenantId === tenantId) {
        return existing;
      }
    }

    const register = await this.findOpen(tenantId);
    if (!register) {
      throw new NotFoundException('Nenhum caixa aberto');
    }
    return this.prisma.cashMovement.create({
      data: {
        cashRegisterId: register.id,
        clientId: dto.clientId ?? null,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason ?? null,
      },
    });
  }

  async history(tenantId: string, query: QueryCashRegisterDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where: { tenantId },
        include: {
          openedBy: { select: { id: true, name: true } },
          _count: { select: { movements: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cashRegister.count({ where: { tenantId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private findOpen(tenantId: string) {
    return this.prisma.cashRegister.findFirst({
      where: { tenantId, status: CashRegisterStatus.OPEN },
      include: { openedBy: { select: { id: true, name: true } } },
    });
  }

  private findOpenDetailed(tenantId: string) {
    return this.prisma.cashRegister.findFirst({
      where: { tenantId, status: CashRegisterStatus.OPEN },
      include: registerInclude,
    });
  }

  private async buildSummary(
    tenantId: string,
    from: Date,
    to: Date | null,
    movements: { type: CashMovementType; amount: unknown }[],
    openingAmount: number,
  ): Promise<CashSummary> {
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: SaleStatus.FINISHED,
        createdAt: { gte: from, ...(to ? { lte: to } : {}) },
      },
      select: {
        total: true,
        payments: { select: { method: true, amount: true } },
      },
    });

    const byMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      PIX: 0,
      CREDIT: 0,
      DEBIT: 0,
    };
    let salesTotal = 0;
    for (const sale of sales) {
      salesTotal += Number(sale.total);
      for (const payment of sale.payments) {
        byMethod[payment.method] += Number(payment.amount);
      }
    }

    const deposits = movements
      .filter((movement) => movement.type === CashMovementType.DEPOSIT)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
    const withdrawals = movements
      .filter((movement) => movement.type === CashMovementType.WITHDRAWAL)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const expectedCash = round2(
      openingAmount + byMethod.CASH + deposits - withdrawals,
    );

    return {
      salesCount: sales.length,
      salesTotal: round2(salesTotal),
      byMethod: {
        CASH: round2(byMethod.CASH),
        PIX: round2(byMethod.PIX),
        CREDIT: round2(byMethod.CREDIT),
        DEBIT: round2(byMethod.DEBIT),
      },
      deposits: round2(deposits),
      withdrawals: round2(withdrawals),
      expectedCash,
    };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
