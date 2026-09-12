import { afterEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
const checkMock = vi.hoisted(() => vi.fn())
const relaunchMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: checkMock,
}))
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: relaunchMock,
}))

import {
  checkForUpdate,
  installUpdateAndRestart,
  isTauri,
  listPrinters,
  printRaw,
} from './tauri'

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

describe('checkForUpdate', () => {
  it('retorna null quando não há atualização', async () => {
    checkMock.mockReset().mockResolvedValue(null)

    expect(await checkForUpdate()).toBeNull()
  })

  it('retorna os dados da atualização quando disponível', async () => {
    checkMock.mockReset().mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
      body: 'Correções de bugs',
      downloadAndInstall: vi.fn(),
    })

    const result = await checkForUpdate()

    expect(result).toEqual({
      version: '0.2.0',
      currentVersion: '0.1.0',
      body: 'Correções de bugs',
    })
  })
})

describe('installUpdateAndRestart', () => {
  it('rejeita quando não há atualização pendente', async () => {
    checkMock.mockReset().mockResolvedValue(null)
    await checkForUpdate()

    await expect(installUpdateAndRestart()).rejects.toThrow(
      'Nenhuma atualização pendente',
    )
  })

  it('baixa, instala e reinicia quando há atualização pendente', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined)
    checkMock.mockReset().mockResolvedValue({
      version: '0.2.0',
      currentVersion: '0.1.0',
      downloadAndInstall,
    })
    relaunchMock.mockReset().mockResolvedValue(undefined)

    await checkForUpdate()
    await installUpdateAndRestart()

    expect(downloadAndInstall).toHaveBeenCalled()
    expect(relaunchMock).toHaveBeenCalled()
  })
})
