import { afterEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

import { isTauri, listPrinters, printRaw } from './tauri'

describe('isTauri', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('retorna false em um navegador comum', () => {
    expect(isTauri()).toBe(false)
  })

  it('retorna true quando window.__TAURI_INTERNALS__ está presente', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    })
    expect(isTauri()).toBe(true)
  })
})

describe('listPrinters', () => {
  it('converte is_default (snake_case) para isDefault (camelCase)', async () => {
    invokeMock.mockReset().mockResolvedValue([
      { name: 'EPSON TM-T20', is_default: true },
      { name: 'Microsoft Print to PDF', is_default: false },
    ])

    const result = await listPrinters()

    expect(invokeMock).toHaveBeenCalledWith('list_printers')
    expect(result).toEqual([
      { name: 'EPSON TM-T20', isDefault: true },
      { name: 'Microsoft Print to PDF', isDefault: false },
    ])
  })
})

describe('printRaw', () => {
  it('envia o nome da impressora e os bytes como array comum', async () => {
    invokeMock.mockReset().mockResolvedValue(undefined)

    await printRaw('EPSON TM-T20', new Uint8Array([1, 2, 3]))

    expect(invokeMock).toHaveBeenCalledWith('print_raw', {
      printerName: 'EPSON TM-T20',
      data: [1, 2, 3],
    })
  })

  it('envia printerName undefined quando null (usa a impressora padrão)', async () => {
    invokeMock.mockReset().mockResolvedValue(undefined)

    await printRaw(null, new Uint8Array([9]))

    expect(invokeMock).toHaveBeenCalledWith('print_raw', {
      printerName: undefined,
      data: [9],
    })
  })
})
