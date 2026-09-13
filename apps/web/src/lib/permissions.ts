import type { UserRole } from './api';
import { useAuth } from './useAuth';

export type Permission =
  | 'sales.create'
  | 'sales.cancel'
  | 'reports.view'
  | 'products.view'
  | 'products.manage'
  | 'categories.manage'
  | 'customers.view'
  | 'customers.manage'
  | 'stock.manage'
  | 'cash.operate'
  | 'users.manage'
  | 'owners.manage'
  | 'settings.manage'
  | 'stores.manage';

export interface PermissionDef {
  key: Permission;
  label: string;
  group: string;
  roles: UserRole[];
}

export const PERMISSIONS: PermissionDef[] = [
  {
    key: 'sales.create',
    label: 'Vender no PDV',
    group: 'Vendas',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    key: 'sales.cancel',
    label: 'Cancelar venda',
    group: 'Vendas',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'reports.view',
    label: 'Ver relatórios e dashboard',
    group: 'Vendas',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    key: 'products.view',
    label: 'Ver produtos',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    key: 'products.manage',
    label: 'Gerenciar produtos',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'categories.manage',
    label: 'Gerenciar categorias',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'customers.view',
    label: 'Ver clientes',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    key: 'customers.manage',
    label: 'Gerenciar clientes',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'stock.manage',
    label: 'Movimentar estoque',
    group: 'Catálogo',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'cash.operate',
    label: 'Operar o caixa (abrir/fechar/sangria)',
    group: 'Operação',
    roles: ['OWNER', 'MANAGER', 'CASHIER'],
  },
  {
    key: 'users.manage',
    label: 'Gerenciar usuários',
    group: 'Administração',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'owners.manage',
    label: 'Definir proprietários',
    group: 'Administração',
    roles: ['OWNER'],
  },
  {
    key: 'settings.manage',
    label: 'Editar configurações da loja',
    group: 'Administração',
    roles: ['OWNER', 'MANAGER'],
  },
  {
    key: 'stores.manage',
    label: 'Gerenciar lojas/filiais',
    group: 'Administração',
    roles: ['OWNER'],
  },
];

export const PERMISSION_GROUPS = [
  'Vendas',
  'Catálogo',
  'Operação',
  'Administração',
];

const permissionMap = new Map(PERMISSIONS.map((item) => [item.key, item]));

export function can(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) {
    return false;
  }
  return permissionMap.get(permission)?.roles.includes(role) ?? false;
}

export function rolePermissions(role: UserRole): Permission[] {
  return PERMISSIONS.filter((permission) =>
    permission.roles.includes(role),
  ).map((permission) => permission.key);
}

export function useCan(): (permission: Permission) => boolean {
  const { user } = useAuth();
  return (permission: Permission) =>
    user?.permissions?.includes(permission) ?? false;
}
