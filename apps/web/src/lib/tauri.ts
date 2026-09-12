import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  body?: string
}

let pendingUpdate: Update | null = null

/** Verifica se há uma atualização disponível para o app desktop. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check()
  if (!update) {
    pendingUpdate = null
    return null
  }
  pendingUpdate = update
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body,
  }
}

/** Baixa e instala a atualização encontrada por `checkForUpdate`, depois reinicia o app. */
export async function installUpdateAndRestart(): Promise<void> {
  if (!pendingUpdate) {
    throw new Error('Nenhuma atualização pendente. Verifique novamente.')
  }
  await pendingUpdate.downloadAndInstall()
  pendingUpdate = null
  await relaunch()
}

export interface PrinterInfo {
  name: string
  isDefault: boolean
}

interface RawPrinterInfo {
  name: string
  is_default: boolean
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  const printers = await invoke<RawPrinterInfo[]>('list_printers')
  return printers.map((printer) => ({
    name: printer.name,
    isDefault: printer.is_default,
  }))
}

export async function printRaw(
  printerName: string | null,
  data: Uint8Array,
): Promise<void> {
  await invoke('print_raw', {
    printerName: printerName ?? undefined,
    data: Array.from(data),
  })
}
