import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '../../common/permissions.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import type { AuthUser } from '../types/auth-user.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const permissions = request.user?.permissions ?? [];
    if (!required.every((permission) => permissions.includes(permission))) {
      throw new ForbiddenException(
        'Seu perfil não tem permissão para esta ação',
      );
    }
    return true;
  }
}
