import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../generated/prisma/enums.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TenantService } from '../tenant/tenant.service.js';
import { UsersService } from './users.service.js';

vi.mock('bcryptjs', () => ({
  hash: vi.fn(async () => 'hashed'),
}));

function createPrismaMock() {
  const prisma: Record<string, any> = {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sale: { count: vi.fn(async () => 0) },
    cashRegister: { count: vi.fn(async () => 0) },
    stockMovement: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (calls: Promise<unknown>[]) => Promise.all(calls)),
  };
  return prisma;
}

function manager(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'manager-1',
    tenantId: 'tenant-1',
    email: 'manager@example.com',
    role: UserRole.MANAGER,
    permissions: ['users.manage'] as never,
    ...overrides,
  } as AuthUser;
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tenantService: { getPlanInfo: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    tenantService = {
      getPlanInfo: vi.fn(async () => ({
        limits: { maxUsers: 10, maxProducts: 100 },
        usage: { users: 1, products: 0 },
        name: 'Grátis',
      })),
    };
    audit = { log: vi.fn() };
    service = new UsersService(
      prisma as unknown as PrismaService,
      tenantService as unknown as TenantService,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejeita atribuir papel OWNER sem a permissão owners.manage', async () => {
      await expect(
        service.create('tenant-1', manager(), {
          name: 'Novo',
          email: 'novo@example.com',
          password: 'Senha123',
          role: UserRole.OWNER,
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejeita e-mail já cadastrado no tenant', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('tenant-1', manager(), {
          name: 'Novo',
          email: 'ja-existe@example.com',
          password: 'Senha123',
          role: UserRole.CASHIER,
        } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita quando o limite de usuários do plano foi atingido', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      tenantService.getPlanInfo.mockResolvedValue({
        limits: { maxUsers: 1, maxProducts: 100 },
        usage: { users: 1, products: 0 },
        name: 'Grátis',
      });

      await expect(
        service.create('tenant-1', manager(), {
          name: 'Novo',
          email: 'novo@example.com',
          password: 'Senha123',
          role: UserRole.CASHIER,
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cria o usuário quando dentro do limite e o papel é permitido', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'Novo',
        email: 'novo@example.com',
        role: UserRole.CASHIER,
        active: true,
        permissionOverrides: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create('tenant-1', manager(), {
        name: 'Novo',
        email: 'Novo@Example.com',
        password: 'Senha123',
        role: UserRole.CASHIER,
      } as never);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'novo@example.com' }),
        }),
      );
      expect(result.id).toBe('u1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.create' }),
      );
    });
  });

  describe('update', () => {
    it('lança NotFoundException quando o usuário não existe no tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', manager(), 'inexistente', {
          name: 'X',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita rebaixar o único OWNER ativo', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'owner-1',
        role: UserRole.OWNER,
        email: 'owner@example.com',
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update(
          'tenant-1',
          manager({ permissions: ['users.manage', 'owners.manage'] as never }),
          'owner-1',
          { role: UserRole.MANAGER } as never,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita promover para OWNER sem a permissão owners.manage', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        role: UserRole.CASHIER,
        email: 'u1@example.com',
      });

      await expect(
        service.update('tenant-1', manager(), 'u1', {
          role: UserRole.OWNER,
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('rejeita excluir o próprio usuário', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        role: UserRole.MANAGER,
      });

      await expect(
        service.remove('tenant-1', 'manager-1', 'manager-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita excluir usuário com histórico (vendas, caixa ou estoque)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        role: UserRole.CASHIER,
      });
      prisma.sale.count.mockResolvedValue(3);

      await expect(
        service.remove('tenant-1', 'manager-1', 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('exclui o usuário quando não há histórico nem é o próprio ator', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        role: UserRole.CASHIER,
        email: 'u1@example.com',
      });

      const result = await service.remove('tenant-1', 'manager-1', 'u1');

      expect(result).toEqual({ id: 'u1' });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
