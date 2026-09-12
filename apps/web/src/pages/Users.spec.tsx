import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedUser } from '../lib/users'
import { Users } from './Users'

const authState = vi.hoisted(() => ({
  user: { id: 'me', role: 'OWNER' as const },
}))

const permissionsState = vi.hoisted(() => ({
  granted: new Set<string>(['users.manage']),
}))

const usersListMock = vi.hoisted(() => vi.fn())
const usersRemoveMock = vi.hoisted(() => vi.fn())
const usersUpdateMock = vi.hoisted(() => vi.fn())
const confirmMock = vi.hoisted(() => vi.fn(async () => true))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/permissions')>()
  return {
    ...actual,
    useCan: () => (permission: string) => permissionsState.granted.has(permission),
  }
})

vi.mock('../components/ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('../components/ui/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('../lib/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/users')>()
  return {
    ...actual,
    usersApi: {
      ...actual.usersApi,
      list: usersListMock,
      remove: usersRemoveMock,
      update: usersUpdateMock,
    },
  }
})

vi.mock('../components/UserFormModal', () => ({
  UserFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="user-form-modal" /> : null,
}))

vi.mock('../components/PasswordModal', () => ({
  PasswordModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="password-modal" /> : null,
}))

function managedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 'u1',
    name: 'Maria Vendedora',
    email: 'maria@example.com',
    role: 'CASHIER',
    active: true,
    permissions: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function paginated(items: ManagedUser[], overrides: Partial<{ total: number; totalPages: number }> = {}) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: 1,
    pageSize: 10,
    totalPages: overrides.totalPages ?? 1,
  }
}

describe('Users', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    authState.user = { id: 'me', role: 'OWNER' }
    permissionsState.granted = new Set(['users.manage'])
    usersListMock.mockReset().mockResolvedValue(paginated([managedUser()]))
    usersRemoveMock.mockReset().mockResolvedValue({ id: 'u1' })
    usersUpdateMock.mockReset().mockResolvedValue(managedUser({ active: false }))
    confirmMock.mockReset().mockResolvedValue(true)
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('exibe aviso de acesso negado quando falta a permissão users.manage', async () => {
    permissionsState.granted = new Set([])
    render(<Users />)

    expect(
      screen.getByText('Você não tem permissão para gerenciar usuários.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(usersListMock).toHaveBeenCalled())
  })

  it('lista os usuários e mostra o papel traduzido', async () => {
    render(<Users />)

    expect(await screen.findByText('Maria Vendedora')).toBeInTheDocument()
    expect(screen.getByText('Operador de caixa')).toBeInTheDocument()
  })

  it('busca usuários por nome/e-mail com debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Users />)
    await screen.findByText('Maria Vendedora')

    await user.type(
      screen.getByPlaceholderText('Buscar por nome ou e-mail'),
      'maria',
    )

    await waitFor(() => {
      expect(usersListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'maria', page: 1 }),
      )
    })
  })

  it('marca o usuário logado com "(você)" e desabilita inativar/excluir para ele mesmo', async () => {
    authState.user = { id: 'u1', role: 'OWNER' }
    render(<Users />)
    await screen.findByText('Maria Vendedora')

    expect(screen.getByText('(você)')).toBeInTheDocument()
    const row = screen.getByText('Maria Vendedora').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    expect(buttons[2]).toBeDisabled() // inativar/ativar
    expect(buttons[3]).toBeDisabled() // excluir
  })

  it('exclui o usuário após confirmação', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Users />)
    await screen.findByText('Maria Vendedora')

    const row = screen.getByText('Maria Vendedora').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(usersRemoveMock).toHaveBeenCalledWith('u1')
    })
    expect(toastMock.success).toHaveBeenCalledWith('Usuário excluído.')
  })

  it('alterna a situação ativo/inativo do usuário', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Users />)
    await screen.findByText('Maria Vendedora')

    const row = screen.getByText('Maria Vendedora').closest('tr') as HTMLElement
    const buttons = within(row).getAllByRole('button')
    await user.click(buttons[2]) // botão de power (ativar/inativar)

    await waitFor(() => {
      expect(usersUpdateMock).toHaveBeenCalledWith('u1', { active: false })
    })
    expect(toastMock.success).toHaveBeenCalledWith('Usuário inativado.')
  })

  it('abre o formulário de criação ao clicar em "Novo usuário"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Users />)
    await screen.findByText('Maria Vendedora')

    await user.click(screen.getByRole('button', { name: /Novo usuário/ }))

    expect(screen.getByTestId('user-form-modal')).toBeInTheDocument()
  })
})
