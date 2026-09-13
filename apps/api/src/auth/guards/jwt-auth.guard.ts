import {
  CanActivate,
  type ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  effectivePermissions,
  type PermissionOverrides,
} from '../../common/permissions.js';
import { TenantStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isSubscriptionUsable } from '../../subscription/subscription.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser, JwtPayload } from '../types/auth-user.js';

function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

const SUBSCRIPTION_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/subscription',
  '/api/tenant',
  '/api/health',
];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: {
          select: {
            status: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
        store: {
          select: { active: true },
        },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }
    if (payload.ver !== undefined && payload.ver !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão encerrada');
    }
    if (user.tenant.status !== TenantStatus.ACTIVE) {
      throw new UnauthorizedException('Empresa inativa ou suspensa');
    }
    if (!user.store.active) {
      throw new UnauthorizedException('Loja inativa');
    }

    const url = request.originalUrl ?? request.url;
    const exempt = SUBSCRIPTION_EXEMPT_PREFIXES.some((prefix) =>
      url.startsWith(prefix),
    );
    if (
      !exempt &&
      !isPlatformAdmin(user.email) &&
      !isSubscriptionUsable(user.tenant)
    ) {
      throw new HttpException(
        'Assinatura pendente ou expirada. Regularize para continuar.',
        402,
      );
    }

    request.user = {
      userId: user.id,
      tenantId: user.tenantId,
      storeId: user.storeId,
      email: user.email,
      role: user.role,
      permissions: effectivePermissions(
        user.role,
        user.permissionOverrides as PermissionOverrides | null,
      ),
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
