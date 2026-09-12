import { invoke } from '@tauri-apps/api/core'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
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
