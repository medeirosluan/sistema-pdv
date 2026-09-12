import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sale } from './sales'

const isTauriMock = vi.hoisted(() => vi.fn())
const printRawMock = vi.hoisted(() => vi.fn())
const getPreferredPrinterMock = vi.hoisted(() => vi.fn())

vi.mock('./tauri', () => ({
  isTauri: isTauriMock,
  printRaw: printRawMock,
}))

vi.mock('./printerSettings', () => ({
  getPreferredPrinter: getPreferredPrinterMock,
}))

import { printReceipt } from './receipt'

function makeSale(): Sale {
  return {
    id: 's1',
    number: 1,
    status: 'FINISHED',
    subtotal: 10,
    discount: 0,
    total: 10,
    customer: null,
    createdBy: { id: 'u1', name: 'Operador' },
    items: [],
    payments: [],
    createdAt: '2026-01-15T10:00:00Z',
  }
}

describe('printReceipt', () => {
  beforeEach(() => {
    isTauriMock.mockReset()
    printRawMock.mockReset().mockResolvedValue(undefined)
    getPreferredPrinterMock.mockReset().mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelectorAll('iframe').forEach((el) => el.remove())
  })

  it('usa a impressão nativa (ESC/POS) quando roda no app desktop', async () => {
    isTauriMock.mockReturnValue(true)
    getPreferredPrinterMock.mockReturnValue('EPSON TM-T20')

    printReceipt(makeSale(), { storeName: 'Loja Demo' })
    await Promise.resolve()
    await Promise.resolve()

    expect(printRawMock).toHaveBeenCalledWith(
      'EPSON TM-T20',
      expect.any(Uint8Array),
    )
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('mostra um alerta quando a impressão nativa falha', async () => {
    isTauriMock.mockReturnValue(true)
    printRawMock.mockRejectedValue(new Error('impressora offline'))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    printReceipt(makeSale(), { storeName: 'Loja Demo' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(alertSpy).toHaveBeenCalled()
  })

  it('usa o diálogo de impressão do navegador (iframe + print) fora do Tauri', () => {
    isTauriMock.mockReturnValue(false)

    printReceipt(makeSale(), { storeName: 'Loja Demo' })

    expect(printRawMock).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).not.toBeNull()
  })
})
