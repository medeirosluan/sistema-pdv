import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantStatus, UserRole } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtPayload } from '../types/auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function createContext(
  headers: Record<string, string> = {},
  overrides: Record<string, unknown> = {},
): ExecutionContext {
  const request: Record<string, unknown> = {
    headers,
    originalUrl: '/api/auth/me',
    ...overrides,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'demo@example.com',
    role: UserRole.OWNER,
    active: true,
    tokenVersion: 0,
    permissionOverrides: null,
    tenantId: 'tenant-1',
    tenant: {
      status: TenantStatus.ACTIVE,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
      currentPeriodEnd: null,
    },
    ...overrides,
  };
}

describe('JwtAuthGuard', () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    reflector = { getAllAndOverride: vi.fn(() => false) };
    prisma = { user: { findUnique: vi.fn() } };
    guard = new JwtAuthGuard(
      jwtService as never,
      reflector as never,
      prisma as unknown as PrismaService,
    );
  });

  it('permite acesso sem token quando a rota é pública', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejeita quando não há token de acesso', async () => {
    const context = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita quando o token é inválido ou expirado', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
    const context = createContext({ authorization: 'Bearer token-invalido' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita quando o usuário não existe ou está inativo', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      ver: 0,
    } as JwtPayload);
    prisma.user.findUnique.mockResolvedValue(null);
    const context = createContext({ authorization: 'Bearer token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita quando o tokenVersion do payload não confere com o do usuário (sessão encerrada)', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      ver: 0,
    } as JwtPayload);
    prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 1 }));
    const context = createContext({ authorization: 'Bearer token-antigo' });

    await expect(guard.canActivate(context)).rejects.toThrow('Sessão encerrada');
  });

  it('permite acesso quando o tokenVersion confere e popula request.user', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      ver: 0,
    } as JwtPayload);
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token-valido' },
      originalUrl: '/api/auth/me',
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ userId: 'user-1', tenantId: 'tenant-1' });
  });

  it('não rejeita por tokenVersion quando o payload não informa a versão (compatibilidade)', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' } as JwtPayload);
    prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 5 }));
    const context = createContext({ authorization: 'Bearer token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
