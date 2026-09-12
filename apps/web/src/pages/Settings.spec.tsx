import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { PlanInfo } from '../lib/tenant'
import type { SubscriptionInfo } from '../lib/subscription'
import { Settings } from './Settings'

const authState = vi.hoisted(() => ({
  user: {
    email: 'dono@example.com',
    role: 'OWNER' as const,
    twoFactorEnabled: false,
    permissions: ['settings.manage'],
  },
  refresh: vi.fn(),
}))

const confirmMock = vi.hoisted(() => vi.fn(async () => true))

const tenantGetMock = vi.hoisted(() => vi.fn())
const tenantUpdateMock = vi.hoisted(() => vi.fn())
const tenantPlanMock = vi.hoisted(() => vi.fn())
const tenantChangePlanMock = vi.hoisted(() => vi.fn())
const subscriptionGetMock = vi.hoisted(() => vi.fn())
const subscriptionCheckoutMock = vi.hoisted(() => vi.fn())
const subscriptionConfirmMock = vi.hoisted(() => vi.fn())
const subscriptionCancelMock = vi.hoisted(() => vi.fn())
const setupTwoFactorMock = vi.hoisted(() => vi.fn())
const enableTwoFactorMock = vi.hoisted(() => vi.fn())
const disableTwoFactorMock = vi.hoisted(() => vi.fn())
const changePasswordMock = vi.hoisted(() => vi.fn())
const isTauriMock = vi.hoisted(() => vi.fn(() => false))
const listPrintersMock = vi.hoisted(() => vi.fn())
const printRawMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: authState.refresh,
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/useConfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('../lib/tenant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/tenant')>()
  return {
    ...actual,
    tenantApi: {
      get: tenantGetMock,
      update: tenantUpdateMock,
      plan: tenantPlanMock,
      changePlan: tenantChangePlanMock,
    },
  }
})

vi.mock('../lib/subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/subscription')>()
  return {
    ...actual,
    subscriptionApi: {
      get: subscriptionGetMock,
      checkout: subscriptionCheckoutMock,
      confirm: subscriptionConfirmMock,
      cancel: subscriptionCancelMock,
    },
  }
})

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      setupTwoFactor: setupTwoFactorMock,
      enableTwoFactor: enableTwoFactorMock,
      disableTwoFactor: disableTwoFactorMock,
      changePassword: changePasswordMock,
    },
  }
})

vi.mock('../lib/tauri', () => ({
  isTauri: isTauriMock,
  listPrinters: listPrintersMock,
  printRaw: printRawMock,
}))

function makeTenant() {
  return {
    id: 't1',
    name: 'Loja Demo',
    slug: 'loja-demo',
    document: null,
    phone: null,
    email: null,
    address: null,
    settings: {},
    plan: 'FREE',
    status: 'ACTIVE',
  }
}

function makePlanInfo(overrides: Partial<PlanInfo> = {}): PlanInfo {
  return {
    plan: 'FREE',
    name: 'Grátis',
    price: 0,
    features: [],
    limits: { maxUsers: 2, maxProducts: 50 },
    usage: { users: 1, products: 10 },
    ...overrides,
  }
}

function makeSubscription(overrides: Partial<SubscriptionInfo> = {}): SubscriptionInfo {
  return {
    plan: 'FREE',
    planName: 'Grátis',
    price: 0,
    status: 'TRIAL',
    trialEndsAt: null,
    currentPeriodEnd: null,
    trialDaysLeft: 10,
    active: true,
    ...overrides,
  }
}

describe('Settings', () => {
  beforeEach(() => {
    authState.user = {
      email: 'dono@example.com',
      role: 'OWNER',
      twoFactorEnabled: false,
      permissions: ['settings.manage'],
    }
    authState.refresh.mockReset().mockResolvedValue(undefined)
    confirmMock.mockReset().mockResolvedValue(true)
    tenantGetMock.mockReset().mockResolvedValue(makeTenant())
    tenantUpdateMock.mockReset().mockResolvedValue(makeTenant())
    tenantPlanMock.mockReset().mockResolvedValue(makePlanInfo())
    tenantChangePlanMock.mockReset().mockResolvedValue(makeTenant())
    subscriptionGetMock.mockReset().mockResolvedValue(makeSubscription())
    subscriptionCheckoutMock.mockReset()
    subscriptionConfirmMock.mockReset()
    subscriptionCancelMock.mockReset()
    setupTwoFactorMock.mockReset()
    enableTwoFactorMock.mockReset()
    disableTwoFactorMock.mockReset()
    changePasswordMock.mockReset()
    isTauriMock.mockReset().mockReturnValue(false)
    listPrintersMock.mockReset().mockResolvedValue([])
    printRawMock.mockReset().mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('carrega e preenche os dados da loja', async () => {
    render(<Settings />)

    expect(await screen.findByDisplayValue('Loja Demo')).toBeInTheDocument()
  })

  it('exibe a mensagem de erro quando falha ao carregar os dados da loja', async () => {
    tenantGetMock.mockRejectedValue(new ApiError(500, 'Erro ao carregar dados'))
    render(<Settings />)

    expect(await screen.findByText('Erro ao carregar dados')).toBeInTheDocument()
  })

  it('desabilita os campos e oculta o botão de salvar quando falta settings.manage', async () => {
    authState.user = { ...authState.user, permissions: [] }
    render(<Settings />)

    const nameInput = await screen.findByDisplayValue('Loja Demo')
    expect(nameInput).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Salvar dados' }),
    ).not.toBeInTheDocument()
  })

  it('salva os dados da loja e mostra a confirmação', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    const nameInput = await screen.findByDisplayValue('Loja Demo')

    await user.clear(nameInput)
    await user.type(nameInput, 'Loja Nova')
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }))

    await waitFor(() => {
      expect(tenantUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Loja Nova' }),
      )
    })
    expect(await screen.findByText('Dados da loja salvos.')).toBeInTheDocument()
    expect(authState.refresh).toHaveBeenCalled()
  })

  it('salva as preferências do PDV', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    await user.click(screen.getByRole('button', { name: 'Salvar preferências' }))

    await waitFor(() => {
      expect(tenantUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ receiptWidth: '58mm' }),
        }),
      )
    })
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument()
  })

  it('rejeita a troca de senha quando a confirmação não confere', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    await user.type(screen.getByLabelText('Senha atual'), 'atual123')
    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'outraSenha123')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(
      await screen.findByText('A nova senha e a confirmação não conferem'),
    ).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('altera a senha com sucesso quando os campos conferem', async () => {
    const user = userEvent.setup()
    changePasswordMock.mockResolvedValue({ id: 'u1' })
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    await user.type(screen.getByLabelText('Senha atual'), 'atual123')
    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'novaSenha123')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith('atual123', 'novaSenha123')
    })
    expect(
      await screen.findByText('Senha alterada com sucesso.'),
    ).toBeInTheDocument()
  })

  it('inicia e confirma a ativação do 2FA', async () => {
    const user = userEvent.setup()
    setupTwoFactorMock.mockResolvedValue({
      secret: 'SECRET123',
      otpauth: 'otpauth://...',
      qrDataUrl: 'data:image/png;base64,xxx',
    })
    enableTwoFactorMock.mockResolvedValue({ enabled: true })
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    await user.click(screen.getByRole('button', { name: 'Ativar 2FA' }))

    expect(await screen.findByAltText('QR Code 2FA')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('000000'), '123456')
    await user.click(screen.getByRole('button', { name: 'Ativar' }))

    await waitFor(() => {
      expect(enableTwoFactorMock).toHaveBeenCalledWith('123456')
    })
    expect(await screen.findByText('2FA ativado.')).toBeInTheDocument()
  })

  it('desativa o 2FA quando já está habilitado', async () => {
    const user = userEvent.setup()
    authState.user = { ...authState.user, twoFactorEnabled: true }
    disableTwoFactorMock.mockResolvedValue({ enabled: false })
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    expect(screen.getByText('2FA ativado')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('000000'), '654321')
    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() => {
      expect(disableTwoFactorMock).toHaveBeenCalledWith('654321')
    })
    expect(await screen.findByText('2FA desativado.')).toBeInTheDocument()
  })

  it('muda para um plano gratuito após confirmação', async () => {
    const user = userEvent.setup()
    tenantPlanMock
      .mockResolvedValueOnce(makePlanInfo({ plan: 'BASIC' }))
      .mockResolvedValueOnce(makePlanInfo({ plan: 'FREE' }))
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    await user.click(await screen.findByRole('button', { name: 'Selecionar' }))

    await waitFor(() => {
      expect(tenantChangePlanMock).toHaveBeenCalledWith('FREE')
    })
    expect(
      await screen.findByText('Plano alterado com sucesso.'),
    ).toBeInTheDocument()
  })

  it('inicia o checkout ao assinar um plano pago (provedor mock)', async () => {
    const user = userEvent.setup()
    subscriptionCheckoutMock.mockResolvedValue({
      provider: 'mock',
      checkoutUrl: 'https://pay.example',
      gatewaySubscriptionId: 'sub_1',
    })
    subscriptionConfirmMock.mockResolvedValue({ id: 'sub_1' })
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    const assinarButtons = screen.getAllByRole('button', { name: 'Assinar' })
    await user.click(assinarButtons[0])

    await waitFor(() => {
      expect(subscriptionCheckoutMock).toHaveBeenCalled()
    })
    expect(subscriptionConfirmMock).toHaveBeenCalled()
    expect(
      await screen.findByText('Assinatura ativada (simulação).'),
    ).toBeInTheDocument()
  })

  it('renderiza a tabela de permissões por papel', async () => {
    render(<Settings />)
    await screen.findByDisplayValue('Loja Demo')

    expect(screen.getByText('Permissões por papel')).toBeInTheDocument()
    expect(screen.getByText('Vender no PDV')).toBeInTheDocument()
    expect(screen.getByText('Definir proprietários')).toBeInTheDocument()
  })

  describe('impressora do cupom (app desktop)', () => {
    it('não mostra a seção de impressora fora do app desktop (navegador/PWA)', async () => {
      render(<Settings />)
      await screen.findByDisplayValue('Loja Demo')

      expect(
        screen.queryByText('Impressora do cupom (app desktop)'),
      ).not.toBeInTheDocument()
      expect(listPrintersMock).not.toHaveBeenCalled()
    })

    it('lista as impressoras instaladas quando roda no app desktop', async () => {
      isTauriMock.mockReturnValue(true)
      listPrintersMock.mockResolvedValue([
        { name: 'EPSON TM-T20', isDefault: true },
        { name: 'Microsoft Print to PDF', isDefault: false },
      ])
      render(<Settings />)
      await screen.findByDisplayValue('Loja Demo')

      expect(
        await screen.findByText('EPSON TM-T20 (padrão)'),
      ).toBeInTheDocument()
      expect(screen.getByText('Microsoft Print to PDF')).toBeInTheDocument()
    })

    it('salva a impressora escolhida e a mantém selecionada', async () => {
      const user = userEvent.setup()
      isTauriMock.mockReturnValue(true)
      listPrintersMock.mockResolvedValue([
        { name: 'EPSON TM-T20', isDefault: true },
      ])
      render(<Settings />)
      await screen.findByDisplayValue('Loja Demo')
      const select = await screen.findByLabelText('Impressora')

      await user.selectOptions(select, 'EPSON TM-T20')

      expect(localStorage.getItem('pdv.printerName')).toBe('EPSON TM-T20')
    })

    it('envia um teste de impressão para a impressora selecionada', async () => {
      const user = userEvent.setup()
      isTauriMock.mockReturnValue(true)
      listPrintersMock.mockResolvedValue([
        { name: 'EPSON TM-T20', isDefault: true },
      ])
      render(<Settings />)
      await screen.findByDisplayValue('Loja Demo')
      const select = await screen.findByLabelText('Impressora')
      await user.selectOptions(select, 'EPSON TM-T20')

      await user.click(screen.getByRole('button', { name: 'Imprimir teste' }))

      await waitFor(() => {
        expect(printRawMock).toHaveBeenCalledWith(
          'EPSON TM-T20',
          expect.any(Uint8Array),
        )
      })
    })

    it('mostra o erro quando o teste de impressão falha', async () => {
      const user = userEvent.setup()
      isTauriMock.mockReturnValue(true)
      listPrintersMock.mockResolvedValue([])
      printRawMock.mockRejectedValue(new Error('Impressora não encontrada'))
      render(<Settings />)
      await screen.findByDisplayValue('Loja Demo')

      await user.click(screen.getByRole('button', { name: 'Imprimir teste' }))

      expect(
        await screen.findByText('Impressora não encontrada'),
      ).toBeInTheDocument()
    })
  })
})
