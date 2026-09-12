import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { Login } from './Login'

const authState = vi.hoisted(() => ({
  user: null as null | { id: string },
  login: vi.fn(),
}))

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: authState.login,
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/painel" element={<div>Painel carregado</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear()
    authState.user = null
    authState.login = vi.fn()
  })

  it('redireciona para o painel quando já existe um usuário autenticado', () => {
    authState.user = { id: 'u1' }
    renderLogin()

    expect(screen.getByText('Painel carregado')).toBeInTheDocument()
  })

  it('renderiza os campos de loja, e-mail e senha quando não há sessão', () => {
    renderLogin()

    expect(screen.getByPlaceholderText('minha-loja')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('voce@loja.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(
      screen.queryByText('Código de verificação (2FA)'),
    ).not.toBeInTheDocument()
  })

  it('faz login com sucesso e navega para o painel', async () => {
    const user = userEvent.setup()
    authState.login.mockResolvedValue(undefined)
    renderLogin()

    await user.type(screen.getByPlaceholderText('minha-loja'), 'Loja-Demo')
    await user.type(
      screen.getByPlaceholderText('voce@loja.com'),
      'demo@example.com',
    )
    await user.type(screen.getByPlaceholderText('••••••••'), 'Senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith(
        'loja-demo',
        'demo@example.com',
        'Senha123',
        undefined,
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Painel carregado')).toBeInTheDocument()
    })
    expect(localStorage.getItem('pdv.lastTenantSlug')).toBe('loja-demo')
  })

  it('exibe a mensagem de erro da API quando o login falha', async () => {
    const user = userEvent.setup()
    authState.login.mockRejectedValue(new ApiError(401, 'Credenciais inválidas'))
    renderLogin()

    await user.type(screen.getByPlaceholderText('minha-loja'), 'loja-demo')
    await user.type(
      screen.getByPlaceholderText('voce@loja.com'),
      'demo@example.com',
    )
    await user.type(screen.getByPlaceholderText('••••••••'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument()
  })

  it('revela o campo de código 2FA quando o erro menciona 2FA', async () => {
    const user = userEvent.setup()
    authState.login.mockRejectedValue(
      new ApiError(401, 'Código de verificação 2FA inválido ou ausente'),
    )
    renderLogin()

    await user.type(screen.getByPlaceholderText('minha-loja'), 'loja-demo')
    await user.type(
      screen.getByPlaceholderText('voce@loja.com'),
      'demo@example.com',
    )
    await user.type(screen.getByPlaceholderText('••••••••'), 'Senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByText('Código de verificação (2FA)'),
    ).toBeInTheDocument()
  })

  it('mostra mensagem genérica quando o erro não é um ApiError', async () => {
    const user = userEvent.setup()
    authState.login.mockRejectedValue(new Error('network down'))
    renderLogin()

    await user.type(screen.getByPlaceholderText('minha-loja'), 'loja-demo')
    await user.type(
      screen.getByPlaceholderText('voce@loja.com'),
      'demo@example.com',
    )
    await user.type(screen.getByPlaceholderText('••••••••'), 'Senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByText('Não foi possível entrar. Tente novamente.'),
    ).toBeInTheDocument()
  })
})
