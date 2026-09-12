import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminSummary, AdminTenant } from '../lib/admin'
import { Admin } from './Admin'

const authState = vi.hoisted(() => ({
  user: { platformAdmin: true },
}))

const adminSummaryMock = vi.hoisted(() => vi.fn())
const adminTenantsMock = vi.hoisted(() => vi.fn())
const adminUpdateTenantMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/admin')>()
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      summary: adminSummaryMock,
      tenants: adminTenantsMock,
      updateTenant: adminUpdateTenantMock,
    },
  }
})

function makeTenant(overrides: Partial<AdminTenant> = {}): AdminTenant {
  return {
    id: 't1',
    name: 'Loja Demo',
    slug: 'loja-demo',
    document: null,
    plan: 'FREE',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    _count: { users: 2, products: 10, sales: 30 },
    ...overrides,
  }
}

function makeSummary(overrides: Partial<AdminSummary> = {}): AdminSummary {
  return {
    tenants: 5,
    activeTenants: 4,
    users: 20,
    products: 200,
    sales: 1000,
    ...overrides,
  }
}

function paginated(items: AdminTenant[], overrides: Partial<{ total: number; totalPages: number }> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: 1,
    pageSize: 10,
    totalPages: overrides.totalPages ?? 1,
  }
}

describe('Admin', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    authState.user = { platformAdmin: true }
    adminSummaryMock.mockReset().mockResolvedValue(makeSummary())
    adminTenantsMock.mockReset().mockResolvedValue(paginated([makeTenant()]))
    adminUpdateTenantMock.mockReset().mockResolvedValue(makeTenant({ plan: 'PRO' }))
  })

  it('bloqueia o acesso para quem não é administrador da plataforma', () => {
    authState.user = { platformAdmin: false }
    render(<Admin />)

    expect(
      screen.getByText('Acesso restrito ao administrador da plataforma.'),
    ).toBeInTheDocument()
  })

  it('mostra o resumo global e lista as lojas', async () => {
    render(<Admin />)

    expect(await screen.findByText('Loja Demo')).toBeInTheDocument()
    expect(screen.getByText('loja-demo')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // total tenants
    expect(screen.getByText('1000')).toBeInTheDocument() // vendas
  })

  it('busca lojas por nome/identificador com debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Admin />)
    await screen.findByText('Loja Demo')

    await user.type(
      screen.getByPlaceholderText('Buscar por nome ou identificador'),
      'demo',
    )

    await waitFor(() => {
      expect(adminTenantsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'demo', page: 1 }),
      )
    })
  })

  it('altera o plano de uma loja pelo select', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Admin />)
    await screen.findByText('Loja Demo')

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'PRO')

    await waitFor(() => {
      expect(adminUpdateTenantMock).toHaveBeenCalledWith('t1', { plan: 'PRO' })
    })
  })

  it('altera a situação de uma loja pelo select', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Admin />)
    await screen.findByText('Loja Demo')

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], 'SUSPENDED')

    await waitFor(() => {
      expect(adminUpdateTenantMock).toHaveBeenCalledWith('t1', {
        status: 'SUSPENDED',
      })
    })
  })

  it('navega entre páginas de lojas', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    adminTenantsMock.mockResolvedValue(
      paginated([makeTenant()], { total: 25, totalPages: 3 }),
    )
    render(<Admin />)
    await screen.findByText('Loja Demo')

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => {
      expect(adminTenantsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
  })
})
