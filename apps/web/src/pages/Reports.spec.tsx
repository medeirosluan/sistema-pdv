import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { SalesReport } from '../lib/reports'
import { Reports } from './Reports'

const reportsSalesMock = vi.hoisted(() => vi.fn())
const downloadCsvMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reports')>()
  return {
    ...actual,
    reportsApi: { ...actual.reportsApi, sales: reportsSalesMock },
  }
})

vi.mock('../lib/csv', () => ({
  downloadCsv: downloadCsvMock,
}))

function makeReport(overrides: Partial<SalesReport> = {}): SalesReport {
  return {
    period: { from: '2026-01-01', to: '2026-01-31' },
    totals: {
      count: 10,
      grossTotal: 1000,
      discountTotal: 50,
      netTotal: 950,
      averageTicket: 95,
    },
    byPayment: [{ method: 'CASH', count: 6, total: 600 }],
    byProduct: [
      { productId: 'p1', description: 'Arroz 5kg', quantity: 4, total: 100 },
    ],
    byDay: [{ date: '2026-01-15', total: 950, count: 10 }],
    ...overrides,
  }
}

describe('Reports', () => {
  beforeEach(() => {
    reportsSalesMock.mockReset().mockResolvedValue(makeReport())
    downloadCsvMock.mockReset()
  })

  it('carrega o relatório do período padrão ao montar', async () => {
    render(<Reports />)

    await waitFor(() => expect(reportsSalesMock).toHaveBeenCalled())
    expect(await screen.findByText('R$ 950,00')).toBeInTheDocument()
    expect(screen.getByText('Arroz 5kg')).toBeInTheDocument()
  })

  it('exibe a mensagem de erro da API quando o relatório falha ao carregar', async () => {
    reportsSalesMock.mockRejectedValue(new ApiError(500, 'Falha ao gerar relatório'))
    render(<Reports />)

    expect(
      await screen.findByText('Falha ao gerar relatório'),
    ).toBeInTheDocument()
  })

  it('recarrega o relatório ao alterar as datas e clicar em Atualizar', async () => {
    const user = userEvent.setup()
    render(<Reports />)
    await waitFor(() => expect(reportsSalesMock).toHaveBeenCalledTimes(1))

    const [fromInput, toInput] = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)
    await user.clear(fromInput)
    await user.type(fromInput, '2026-02-01')
    await user.clear(toInput)
    await user.type(toInput, '2026-02-28')
    await user.click(screen.getByRole('button', { name: /Atualizar/ }))

    await waitFor(() => {
      expect(reportsSalesMock).toHaveBeenLastCalledWith({
        from: '2026-02-01',
        to: '2026-02-28',
      })
    })
  })

  it('exporta o CSV de pagamentos quando há dados', async () => {
    const user = userEvent.setup()
    render(<Reports />)
    await screen.findByText('Arroz 5kg')

    const csvButtons = screen.getAllByRole('button', { name: /CSV/ })
    await user.click(csvButtons[0])

    expect(downloadCsvMock).toHaveBeenCalledWith(
      expect.stringMatching(/^pagamentos_.*\.csv$/),
      expect.arrayContaining([
        ['Forma de pagamento', 'Vendas', 'Total (R$)'],
      ]),
    )
  })

  it('exporta o CSV de produtos quando há dados', async () => {
    const user = userEvent.setup()
    render(<Reports />)
    await screen.findByText('Arroz 5kg')

    const csvButtons = screen.getAllByRole('button', { name: /CSV/ })
    await user.click(csvButtons[1])

    expect(downloadCsvMock).toHaveBeenCalledWith(
      expect.stringMatching(/^produtos_.*\.csv$/),
      expect.arrayContaining([['Produto', 'Quantidade', 'Total (R$)']]),
    )
  })

  it('desabilita os botões de CSV quando não há dados no período', async () => {
    reportsSalesMock.mockResolvedValue(
      makeReport({ byPayment: [], byProduct: [], byDay: [] }),
    )
    render(<Reports />)

    await waitFor(() => {
      expect(screen.getAllByText('Sem dados.').length).toBeGreaterThan(0)
    })
    const csvButtons = screen.getAllByRole('button', { name: /CSV/ })
    expect(csvButtons[0]).toBeDisabled()
    expect(csvButtons[1]).toBeDisabled()
  })
})
