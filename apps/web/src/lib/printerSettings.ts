const STORAGE_KEY = 'pdv.printerName'

/** Nome da impressora preferida para o cupom no app desktop (Tauri). `null` = usar a impressora padrão do sistema. */
export function getPreferredPrinter(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setPreferredPrinter(name: string | null): void {
  if (name) {
    localStorage.setItem(STORAGE_KEY, name)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}
