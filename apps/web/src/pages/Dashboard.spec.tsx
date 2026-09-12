import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { DashboardSummary, SalesReport } from '../lib/reports'
import { Dashboard } from './Dashboard'

const authState = vi.hoisted(() => ({
  user: { name: 'Ana Proprietária' },
}))

const reportsSummaryMock = vi.hoisted(() => vi.fn())
const reportsSalesMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/useAuth', () => ({
  useAuth: () => ({
    user: authState.user,
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('../lib/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reports')>()
  return {
    ...actual,
    reportsApi: {
      ...actual.reportsApi,
      summary: reportsSummaryMock,
      sales: reportsSalesMock,
    },
  }
})

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    today: { total: 500, count: 3 },
    month: { total: 12000, count: 80 },
    averageTicket: 150,
    products: { total: 40, active: 38, lowStock: 0 },
    customers: { total: 12 },
    recentSales: [],
    salesByDay: [{ date: '2026-01-15', total: 500, count: 3 }],
    ...overrides,
  }
}

function makeReport(overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    period: { from: '', to: '' },
    totals: { count: 0, grossTotal: 0, discountTotal: 0, netTotal: 0, averageTicket: 0 },
    byPayment: [],
    byProduct: [],
    byDay: [],
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    authState.user = { name: 'Ana Proprietária' }
    reportsSummaryMock.mockReset().mockResolvedValue(makeSummary())
    reportsSalesMock.mockReset().mockResolvedValue(makeReport())
  })

  it('cumprimenta o usuário pelo primeiro nome', async () => {
    renderDashboard()

    expect(await screen.findByText('Olá, Ana')).toBeInTheDocument()
  })

  it('mostra os cartões de resumo com os valores formatados', async () => {
    renderDashboard()

    expect(await screen.findByText('R$ 500,00')).toBeInTheDocument()
    expect(screen.getByText('3 venda(s)')).toBeInTheDocument()
    expect(screen.getByText('R$ 12.000,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument()
  })

  it('exibe o alerta de estoque baixo quando há produtos abaixo do mínimo', async () => {
    reportsSummaryMock.mockResolvedValue(
      makeSummary({ products: { total: 40, active: 38, lowStock: 3 } }),
    )
    renderDashboard()

    expect(
      await screen.findByText(
        '3 produto(s) com estoque abaixo ou igual ao mínimo definido.',
      ),
    ).toBeInTheDocument()
  })

  it('não exibe o alerta de estoque baixo quando não há produtos em falta', async () => {
    renderDashboard()

    await screen.findByText('Olá, Ana')
    expect(
      screen.queryByText(/com estoque abaixo ou igual ao mínimo/),
    ).not.toBeInTheDocument()
  })

  it('lista as vendas recentes ou a mensagem de vazio', async () => {
    reportsSummaryMock.mockResolvedValue(
      makeSummary({
        recentSales: [
          {
            id: 's1',
            number: 42,
            total: 99.9,
            createdAt: '2026-01-15T10:00:00Z',
            customer: { id: 'c1', name: 'João' },
          },
        ],
      }),
    )
    renderDashboard()

    expect(await screen.findByText('#42')).toBeInTheDocument()
    expect(screen.getByText(/João/)).toBeInTheDocument()
  })

  it('mostra mensagem de nenhuma venda quando a lista está vazia', async () => {
    renderDashboard()

    expect(
      await screen.findByText('Nenhuma venda registrada.'),
    ).toBeInTheDocument()
  })

  it('exibe a mensagem de erro da API quando o carregamento falha', async () => {
    reportsSummaryMock.mockRejectedValue(
      new ApiError(500, 'Erro ao carregar o resumo'),
    )
    renderDashboard()

    expect(
      await screen.findByText('Erro ao carregar o resumo'),
    ).toBeInTheDocument()
  })
})
