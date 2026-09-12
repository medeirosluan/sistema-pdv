import { describe, expect, it } from 'vitest'
import type { Sale } from './sales'
import type { ReceiptOptions } from './receipt'
import { buildReceiptEscPos, buildTestPrintEscPos, encodeCp860 } from './escpos'

describe('encodeCp860', () => {
  it('mantém caracteres ASCII imprimíveis inalterados', () => {
    expect(encodeCp860('ABC 123')).toEqual([
      0x41, 0x42, 0x43, 0x20, 0x31, 0x32, 0x33,
    ])
  })

  it('mapeia caracteres acentuados portugueses para os bytes CP860 corretos', () => {
    // valores confirmados contra a tabela oficial CP860 da Unicode.org
    // e os testes da crate escpos-rs (protocol.rs)
    expect(encodeCp860('é')).toEqual([0x82])
    expect(encodeCp860('ã')).toEqual([0x84])
    expect(encodeCp860('ç')).toEqual([0x87])
    expect(encodeCp860('õ')).toEqual([0x94])
    expect(encodeCp860('Ç')).toEqual([0x80])
    expect(encodeCp860('á')).toEqual([0xa0])
    expect(encodeCp860('í')).toEqual([0xa1])
    expect(encodeCp860('ó')).toEqual([0xa2])
    expect(encodeCp860('ú')).toEqual([0xa3])
  })

  it('codifica uma frase completa em português', () => {
    expect(encodeCp860('My text é ã ç õ')).toEqual([
      77, 121, 32, 116, 101, 120, 116, 32, 130, 32, 132, 32, 135, 32, 148,
    ])
  })

  it('usa a remoção de acento como último recurso para caracteres fora da tabela', () => {
    // 'ẽ' (e til) não está na tabela CP860 curada; deve degradar para 'e' comum
    expect(encodeCp860('ẽ')).toEqual([0x65])
  })

  it('substitui por "?" quando não há forma de representar o caractere', () => {
    expect(encodeCp860('日')).toEqual([0x3f])
  })
})

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    number: 42,
    status: 'FINISHED',
    subtotal: 100,
    discount: 10,
    total: 90,
    customer: { id: 'c1', name: 'João' },
    createdBy: { id: 'u1', name: 'Operador' },
    items: [
      {
        id: 'i1',
        productId: 'p1',
        description: 'Arroz 5kg',
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        total: 100,
      },
    ],
    payments: [{ id: 'pay1', method: 'CASH', amount: 90, installments: 1 }],
    createdAt: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeOptions(overrides: Partial<ReceiptOptions> = {}): ReceiptOptions {
  return {
    storeName: 'Loja Demo',
    paperWidth: '58mm',
    ...overrides,
  }
}

const ESC = 0x1b
const GS = 0x1d

describe('buildReceiptEscPos', () => {
  it('inicia com ESC @ e seleciona o code page PC860', () => {
    const bytes = buildReceiptEscPos(makeSale(), makeOptions())
    expect(Array.from(bytes.slice(0, 5))).toEqual([ESC, 0x40, ESC, 0x74, 0x03])
  })

  it('termina com alimentação de papel e corte total (GS V A 0)', () => {
    const bytes = buildReceiptEscPos(makeSale(), makeOptions())
    const tail = Array.from(bytes.slice(-4))
    expect(tail).toEqual([GS, 0x56, 0x41, 0x00])
  })

  it('inclui o nome da loja, itens e total formatados', () => {
    const bytes = buildReceiptEscPos(makeSale(), makeOptions())
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text).toContain('Loja Demo')
    expect(text).toContain('Arroz 5kg')
    expect(text).toContain('Venda #42')
    expect(text).toContain('TOTAL')
  })

  it('não inclui o cliente quando a venda não tem um vinculado', () => {
    const bytes = buildReceiptEscPos(makeSale({ customer: null }), makeOptions())
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text).not.toContain('Cliente:')
  })

  it('usa 48 colunas para papel de 80mm e 32 para 58mm', () => {
    const wide = buildReceiptEscPos(makeSale(), makeOptions({ paperWidth: '80mm' }))
    const narrow = buildReceiptEscPos(makeSale(), makeOptions({ paperWidth: '58mm' }))
    const wideText = new TextDecoder('latin1').decode(wide)
    const narrowText = new TextDecoder('latin1').decode(narrow)
    const wideSeparator = wideText.split('\n').find((line) => /^-+$/.test(line))
    const narrowSeparator = narrowText
      .split('\n')
      .find((line) => /^-+$/.test(line))
    expect(wideSeparator).toHaveLength(48)
    expect(narrowSeparator).toHaveLength(32)
  })

  it('codifica corretamente nomes com acentuação portuguesa', () => {
    const bytes = buildReceiptEscPos(
      makeSale({ createdBy: { id: 'u1', name: 'José da Conceição' } }),
      makeOptions(),
    )
    // 'é' -> 0x82, 'ç' -> 0x87, 'ã' -> 0x84 (verificado em encodeCp860)
    const text = Array.from(bytes)
    const nameStart = text.findIndex((_, i) =>
      text.slice(i, i + 4).join(',') === [0x4a, 0x6f, 0x73, 0x82].join(','),
    )
    expect(nameStart).toBeGreaterThan(-1)
  })
})

describe('buildTestPrintEscPos', () => {
  it('gera um payload não vazio terminando em corte de papel', () => {
    const bytes = buildTestPrintEscPos('58mm')
    expect(bytes.length).toBeGreaterThan(10)
    expect(Array.from(bytes.slice(-4))).toEqual([GS, 0x56, 0x41, 0x00])
  })

  it('inclui o texto de teste', () => {
    const bytes = buildTestPrintEscPos('58mm')
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text).toContain('Teste de impress')
  })
})
