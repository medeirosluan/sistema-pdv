import { describe, expect, it } from 'vitest'
import { formatBRL, formatDateTime } from './format'

describe('formatBRL', () => {
  it('formata números como moeda brasileira', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
  })

  it('aceita valores em string', () => {
    expect(formatBRL('99.9')).toBe('R$ 99,90')
  })

  it('trata null, undefined e NaN como zero', () => {
    expect(formatBRL(null)).toBe('R$ 0,00')
    expect(formatBRL(undefined)).toBe('R$ 0,00')
    expect(formatBRL('abc')).toBe('R$ 0,00')
  })
})

describe('formatDateTime', () => {
  it('retorna travessão quando o valor é vazio', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('formata uma data ISO no padrão pt-BR', () => {
    const result = formatDateTime('2026-01-15T13:05:00Z')
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/)
  })
})
