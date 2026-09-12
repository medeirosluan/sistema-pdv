import { afterEach, describe, expect, it } from 'vitest'
import { getPreferredPrinter, setPreferredPrinter } from './printerSettings'

describe('printerSettings', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('retorna null quando nenhuma impressora foi configurada', () => {
    expect(getPreferredPrinter()).toBeNull()
  })

  it('salva e lê o nome da impressora preferida', () => {
    setPreferredPrinter('EPSON TM-T20')
    expect(getPreferredPrinter()).toBe('EPSON TM-T20')
  })

  it('remove a preferência quando definida como null (volta a usar a padrão do sistema)', () => {
    setPreferredPrinter('EPSON TM-T20')
    setPreferredPrinter(null)
    expect(getPreferredPrinter()).toBeNull()
  })
})
