import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantStatus, UserRole } from '../generated/prisma/enums.js';
import type { AuditService } from '../audit/audit.service.js';
import type { MailService } from '../mail/mail.module.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(async () => 'hashed'),
}));

vi.mock('otplib', () => ({
  generateSecret: vi.fn(() => 'SECRET'),
  generateURI: vi.fn(() => 'otpauth://totp/example'),
  verifySync: vi.fn(),
}));

import * as bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';

function baseTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tenant-1',
    slug: 'loja-demo',
    status: TenantStatus.ACTIVE,
    ...overrides,
  };
}

function baseUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    storeId: 'store-1',
    email: 'demo@example.com',
    name: 'Demo',
    passwordHash: 'hash',
    role: UserRole.OWNER,
    active: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    tokenVersion: 0,
    permissionOverrides: null,
    ...overrides,
  };
}

function baseStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'store-1',
    tenantId: 'tenant-1',
    name: 'Loja principal',
    slug: 'principal',
    active: true,
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma: Record<string, any> = {
    tenant: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(async () => baseTenant()),
      create: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(async () => baseStore()),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  const jwtService = {
    signAsync: vi.fn(async () => 'signed-token'),
    verifyAsync: vi.fn(),
  };
  const config = {
    getOrThrow: vi.fn(() => 'refresh-secret'),
    get: vi.fn((key: string) => {
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    }),
  };
  const audit = { log: vi.fn() };
  const mail = { send: vi.fn() };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwtService as never,
    config as never,
    audit as unknown as AuditService,
    mail as unknown as MailService,
  );

  return { service, jwtService, audit, mail };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
  });

  describe('login', () => {
    it('rejeita quando a loja não existe ou não está ativa', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      const { service } = createService(prisma);

      await expect(
        service.login({
          tenantSlug: 'loja-demo',
          email: 'demo@example.com',
          password: 'x',
        } as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita senha incorreta e registra auditoria de falha', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.user.findUnique.mockResolvedValue(baseUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const { service, audit } = createService(prisma);

      await expect(
        service.login({
          tenantSlug: 'loja-demo',
          email: 'demo@example.com',
          password: 'errada',
        } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.failed' }),
      );
    });

    it('exige código 2FA válido quando habilitado', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(verifySync).mockReturnValue({ valid: false } as never);
      const { service } = createService(prisma);

      await expect(
        service.login({
          tenantSlug: 'loja-demo',
          email: 'demo@example.com',
          password: 'correta',
        } as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('autentica com sucesso e retorna tokens quando as credenciais são válidas', async () => {
      prisma.tenant.findUnique.mockResolvedValue(baseTenant());
      prisma.user.findUnique.mockResolvedValue(baseUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const { service, audit } = createService(prisma);

      const result = await service.login({
        tenantSlug: 'loja-demo',
        email: 'demo@example.com',
        password: 'correta',
      } as never);

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe('demo@example.com');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login' }),
      );
    });
  });

  describe('changePassword', () => {
    it('rejeita quando a senha atual está incorreta', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const { service } = createService(prisma);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'errada',
          newPassword: 'NovaSenha123',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('atualiza a senha e incrementa tokenVersion quando a senha atual confere', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const { service } = createService(prisma);

      await service.changePassword('user-1', {
        currentPassword: 'correta',
        newPassword: 'NovaSenha123',
      } as never);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('refresh', () => {
    it('rejeita quando o tokenVersion do payload não confere com o do usuário', async () => {
      const { service, jwtService } = createService(prisma);
      vi.mocked(jwtService.verifyAsync).mockResolvedValue({
        sub: 'user-1',
        ver: 1,
      } as never);
      prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 2 }));

      await expect(service.refresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita quando o refresh token é inválido', async () => {
      const { service, jwtService } = createService(prisma);
      vi.mocked(jwtService.verifyAsync).mockRejectedValue(new Error('bad'));

      await expect(service.refresh('token-invalido')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('renova os tokens quando o tokenVersion confere', async () => {
      const { service, jwtService } = createService(prisma);
      vi.mocked(jwtService.verifyAsync).mockResolvedValue({
        sub: 'user-1',
        ver: 0,
      } as never);
      prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 0 }));

      const result = await service.refresh('token-valido');
      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('resetPassword', () => {
    it('rejeita token inválido ou expirado', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const { service } = createService(prisma);

      await expect(
        service.resetPassword({
          token: 'invalido',
          password: 'NovaSenha123',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('redefine a senha e limpa o token quando válido', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser());
      const { service } = createService(prisma);

      await service.resetPassword({
        token: 'valido',
        password: 'NovaSenha123',
      } as never);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetTokenHash: null,
            passwordResetExpires: null,
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });
  });
});
