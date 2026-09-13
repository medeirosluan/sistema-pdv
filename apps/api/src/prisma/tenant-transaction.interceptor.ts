import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import type { Request } from 'express';
import { PrismaService } from './prisma.service.js';
import { tenantContext } from './tenant-context.js';
import type { AuthUser } from '../auth/types/auth-user.js';

function isPlatformAdmin(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user?.tenantId) {
      return next.handle();
    }

    const bypass = isPlatformAdmin(user.email) ? 'on' : 'off';
    const tenantId = user.tenantId;
    const storeId = user.storeId;

    return from(
      this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.store_id', ${storeId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.bypass', ${bypass}, true)`;
          return tenantContext.run(tx, () => lastValueFrom(next.handle()));
        },
        { timeout: 30_000 },
      ),
    );
  }
}
