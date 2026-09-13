import { describe, expect, it } from 'vitest';
import {
  computeOverrides,
  effectivePermissions,
  isPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from './permissions.js';

describe('permissions', () => {
  it('OWNER tem todas as permissões', () => {
    expect(effectivePermissions('OWNER', null)).toEqual([...PERMISSIONS]);
  });

  it('CASHIER tem o conjunto padrão', () => {
    const permissions = effectivePermissions('CASHIER', null);
    expect(permissions).toContain('sales.create');
    expect(permissions).toContain('cash.operate');
    expect(permissions).not.toContain('cash.history');
    expect(permissions).not.toContain('reports.view');
    expect(permissions).not.toContain('products.manage');
  });

  it('grant adiciona permissão fora do papel', () => {
    const permissions = effectivePermissions('CASHIER', {
      grant: ['sales.cancel'],
    });
    expect(permissions).toContain('sales.cancel');
  });

  it('computeOverrides gera grant e deny a partir do desejado', () => {
    const overrides = computeOverrides('CASHIER', [
      'sales.create',
      'sales.cancel',
    ]);
    expect(overrides.grant).toContain('sales.cancel');
    expect(overrides.deny).toContain('cash.operate');
  });

  it('isPermission valida chaves', () => {
    expect(isPermission('sales.create')).toBe(true);
    expect(isPermission('foo.bar')).toBe(false);
  });

  it('todos os papéis usam permissões válidas', () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });
});
