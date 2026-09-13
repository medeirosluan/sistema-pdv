import { describe, expect, it } from 'vitest'
import { can, PERMISSIONS, rolePermissions } from './permissions'

describe('can', () => {
  it('retorna false quando não há papel definido', () => {
    expect(can(null, 'sales.create')).toBe(false)
    expect(can(undefined, 'sales.create')).toBe(false)
  })

  it('CASHIER pode vender mas não pode cancelar venda', () => {
    expect(can('CASHIER', 'sales.create')).toBe(true)
    expect(can('CASHIER', 'sales.cancel')).toBe(false)
  })

  it('apenas OWNER pode definir proprietários', () => {
    expect(can('OWNER', 'owners.manage')).toBe(true)
    expect(can('MANAGER', 'owners.manage')).toBe(false)
    expect(can('CASHIER', 'owners.manage')).toBe(false)
  })
})

describe('rolePermissions', () => {
  it('retorna todas as permissões cujo papel está incluído', () => {
    const cashierPermissions = rolePermissions('CASHIER')
    expect(cashierPermissions).toContain('sales.create')
    expect(cashierPermissions).toContain('sales.view')
    expect(cashierPermissions).toContain('cash.operate')
    expect(cashierPermissions).not.toContain('cash.history')
    expect(cashierPermissions).not.toContain('reports.view')
    expect(cashierPermissions).not.toContain('products.manage')
  })

  it('OWNER tem acesso a todas as permissões definidas', () => {
    expect(rolePermissions('OWNER')).toHaveLength(PERMISSIONS.length)
  })
})
