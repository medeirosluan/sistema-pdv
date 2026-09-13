import { UserRole } from '../generated/prisma/enums.js';

export const PERMISSIONS = [
  'sales.create',
  'sales.cancel',
  'sales.view',
  'reports.view',
  'products.view',
  'products.manage',
  'categories.manage',
  'customers.view',
  'customers.manage',
  'stock.manage',
  'cash.operate',
  'cash.history',
  'users.manage',
  'owners.manage',
  'settings.manage',
  'stores.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [...PERMISSIONS],
  MANAGER: [
    'sales.create',
    'sales.cancel',
    'sales.view',
    'reports.view',
    'products.view',
    'products.manage',
    'categories.manage',
    'customers.view',
    'customers.manage',
    'stock.manage',
    'cash.operate',
    'cash.history',
    'users.manage',
    'settings.manage',
  ],
  CASHIER: [
    'sales.create',
    'sales.view',
    'products.view',
    'customers.view',
    'cash.operate',
  ],
};

export interface PermissionOverrides {
  grant?: Permission[];
  deny?: Permission[];
}

export function effectivePermissions(
  role: UserRole,
  overrides: PermissionOverrides | null | undefined,
): Permission[] {
  const base = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  for (const permission of overrides?.grant ?? []) {
    base.add(permission);
  }
  for (const permission of overrides?.deny ?? []) {
    base.delete(permission);
  }
  return PERMISSIONS.filter((permission) => base.has(permission));
}

export function computeOverrides(
  role: UserRole,
  desired: Permission[],
): PermissionOverrides {
  const defaults = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  const wanted = new Set<Permission>(desired);
  const grant = PERMISSIONS.filter(
    (permission) => wanted.has(permission) && !defaults.has(permission),
  );
  const deny = PERMISSIONS.filter(
    (permission) => !wanted.has(permission) && defaults.has(permission),
  );
  return { grant, deny };
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
