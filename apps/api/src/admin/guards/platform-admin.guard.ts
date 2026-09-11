import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.js';

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
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!isPlatformAdmin(request.user?.email)) {
      throw new ForbiddenException(
        'Acesso restrito ao administrador da plataforma',
      );
    }
    return true;
  }
}
