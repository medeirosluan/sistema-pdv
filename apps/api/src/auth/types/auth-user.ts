import type { Permission } from '../../common/permissions.js';
import type { UserRole } from '../../generated/prisma/enums.js';

export interface AuthUser {
  userId: string;
  tenantId: string;
  storeId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
  storeId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  ver?: number;
}
