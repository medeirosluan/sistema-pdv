import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CashMovementType,
  PaymentMethod,
  SaleStatus,
} from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CashRegisterService } from './cash-register.service.js';

function createPrismaMock() {
  return {
    cashRegister: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    cashMovement: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sale: {
      findMany: vi.fn(),
    },
  };
}

describe('CashRegisterService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: CashRegisterService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: vi.fn() };
    service = new CashRegisterService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    prisma.sale.findMany.mockResolvedValue([]);
  });

  describe('open', () => {
    it('rejeita abrir um novo caixa se já existir um aberto', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 'reg-1' });

      await expect(
        service.open(
          'tenant-1',
          'store-1',
          'user-1',
          { openingAmount: 100 } as never,
          { email: 'demo@example.com' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('abre um caixa quando não há nenhum aberto', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.cashRegister.create.mockResolvedValue({ id: 'reg-1' });

      const result = await service.open(
        'tenant-1',
        'store-1',
        'user-1',
        { openingAmount: 100 } as never,
        { email: 'demo@example.com' },
      );

      expect(result).toEqual({ id: 'reg-1' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cash.open' }),
      );
    });

    it('retorna o caixa existente quando o clientId já foi processado (idempotência, ex.: sincronização offline)', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 'reg-1',
        clientId: 'client-abc',
      });

      const result = await service.open(
        'tenant-1',
        'store-1',
        'user-1',
        { clientId: 'client-abc', openingAmount: 100 } as never,
        { email: 'demo@example.com' },
      );

      expect(result).toEqual({ id: 'reg-1', clientId: 'client-abc' });
      expect(prisma.cashRegister.create).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('lança NotFoundException quando não há caixa aberto', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(
        service.close(
          'tenant-1',
          'store-1',
          { closingAmount: 100 } as never,
          { userId: 'user-1', email: 'demo@example.com' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('calcula o valor esperado em caixa e a diferença corretamente', async () => {
      const openedAt = new Date('2026-01-01T08:00:00Z');
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 'reg-1',
        openedAt,
        openingAmount: 100,
        movements: [
          { type: CashMovementType.DEPOSIT, amount: 20 },
          { type: CashMovementType.WITHDRAWAL, amount: 5 },
        ],
      });
      prisma.sale.findMany.mockResolvedValue([
        {
          total: 50,
          payments: [{ method: PaymentMethod.CASH, amount: 50 }],
        },
        {
          total: 30,
          payments: [{ method: PaymentMethod.PIX, amount: 30 }],
        },
      ]);
      prisma.cashRegister.update.mockResolvedValue({ id: 'reg-1' });

      const result = await service.close(
        'tenant-1',
        'store-1',
        { closingAmount: 170 } as never,
        { userId: 'user-1', email: 'demo@example.com' },
      );

      // expected = opening(100) + cash sales(50) + deposits(20) - withdrawals(5) = 165
      expect(result.summary.expectedCash).toBe(165);
      expect(result.summary.salesTotal).toBe(80);
      expect(result.difference).toBe(5);
      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: 'store-1',
            status: SaleStatus.FINISHED,
          }),
        }),
      );
    });

    it('retorna o resultado já calculado quando o clientId de fechamento já foi processado (idempotência)', async () => {
      const openedAt = new Date('2026-01-01T08:00:00Z');
      const closedAt = new Date('2026-01-01T18:00:00Z');
      prisma.cashRegister.findFirst
        .mockResolvedValueOnce(null) // não há caixa aberto (já foi fechado antes)
        .mockResolvedValueOnce({
          id: 'reg-1',
          openedAt,
          closedAt,
          openingAmount: 100,
          closingAmount: 170,
          movements: [],
        }); // encontrado pelo closeClientId

      const result = await service.close(
        'tenant-1',
        'store-1',
        { clientId: 'client-close-1', closingAmount: 170 } as never,
        { userId: 'user-1', email: 'demo@example.com' },
      );

      expect(result.register).toEqual(
        expect.objectContaining({ id: 'reg-1' }),
      );
      expect(result.summary.expectedCash).toBe(100);
      expect(result.difference).toBe(70);
      expect(prisma.cashRegister.update).not.toHaveBeenCalled();
    });
  });

  describe('addMovement', () => {
    it('lança NotFoundException quando não há caixa aberto', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(
        service.addMovement(
          'tenant-1',
          'store-1',
          { type: CashMovementType.DEPOSIT, amount: 10 } as never,
          { userId: 'user-1', email: 'demo@example.com' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna o movimento existente quando o clientId já foi processado (idempotência)', async () => {
      prisma.cashMovement.findUnique.mockResolvedValue({
        id: 'mov-1',
        cashRegister: { storeId: 'store-1' },
      });

      const result = await service.addMovement(
        'tenant-1',
        'store-1',
        {
          clientId: 'client-abc',
          type: CashMovementType.DEPOSIT,
          amount: 10,
        } as never,
        { userId: 'user-1', email: 'demo@example.com' },
      );

      expect(result).toEqual({
        id: 'mov-1',
        cashRegister: { storeId: 'store-1' },
      });
      expect(prisma.cashRegister.findFirst).not.toHaveBeenCalled();
    });

    it('cria um novo movimento e registra auditoria', async () => {
      prisma.cashMovement.findUnique.mockResolvedValue(null);
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 'reg-1' });
      prisma.cashMovement.create.mockResolvedValue({ id: 'mov-2' });

      const result = await service.addMovement(
        'tenant-1',
        'store-1',
        { type: CashMovementType.WITHDRAWAL, amount: 15, reason: 'sangria' } as never,
        { userId: 'user-1', email: 'demo@example.com' },
      );

      expect(result).toEqual({ id: 'mov-2' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cash.withdrawal' }),
      );
    });
  });
});
