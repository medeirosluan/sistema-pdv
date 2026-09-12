import { formatBRL, formatDateTime } from './format'
import { paymentMethodLabels, type Sale } from './sales'
import type { ReceiptOptions } from './receipt'

const ESC = 0x1b
const GS = 0x1d

// Tabela oficial CP860 (IBM/DOS Português), bytes 0x80-0xff.
// Fonte: https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/PC/CP860.TXT
// Verificada também contra o mapeamento usado pela crate escpos-rs.
const CP860_HIGH_TABLE: readonly [string, number][] = [
  ['Ç', 0x80], ['ü', 0x81], ['é', 0x82], ['â', 0x83], ['ã', 0x84], ['à', 0x85],
  ['Á', 0x86], ['ç', 0x87], ['ê', 0x88], ['Ê', 0x89], ['è', 0x8a], ['Í', 0x8b],
  ['Ô', 0x8c], ['ì', 0x8d], ['Ã', 0x8e], ['Â', 0x8f], ['É', 0x90], ['À', 0x91],
  ['È', 0x92], ['ô', 0x93], ['õ', 0x94], ['ò', 0x95], ['Ú', 0x96], ['ù', 0x97],
  ['Ì', 0x98], ['Õ', 0x99], ['Ü', 0x9a], ['¢', 0x9b], ['£', 0x9c], ['Ù', 0x9d],
  ['₧', 0x9e], ['Ó', 0x9f], ['á', 0xa0], ['í', 0xa1], ['ó', 0xa2], ['ú', 0xa3],
  ['ñ', 0xa4], ['Ñ', 0xa5], ['ª', 0xa6], ['º', 0xa7], ['¿', 0xa8], ['Ò', 0xa9],
  ['¬', 0xaa], ['½', 0xab], ['¼', 0xac], ['¡', 0xad], ['«', 0xae], ['»', 0xaf],
  ['°', 0xf8], ['·', 0xfa],
]

const CP860_MAP = new Map<string, number>(CP860_HIGH_TABLE)

/** Remove acentos de um caractere não coberto pela tabela CP860, como último recurso. */
function stripDiacritic(char: string): string {
  const decomposed = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return decomposed || '?'
}

export function encodeCp860(text: string): number[] {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code)
      continue
    }
    const mapped = CP860_MAP.get(char)
    if (mapped !== undefined) {
      bytes.push(mapped)
      continue
    }
    const fallback = stripDiacritic(char)
    for (const fallbackChar of fallback) {
      const fallbackCode = fallbackChar.codePointAt(0) ?? 0x3f
      bytes.push(fallbackCode >= 0x20 && fallbackCode <= 0x7e ? fallbackCode : 0x3f)
    }
  }
  return bytes
}

type Align = 'left' | 'center' | 'right'

const ALIGN_CODE: Record<Align, number> = { left: 0, center: 1, right: 2 }

/** Colunas de texto disponíveis por largura de papel (fonte A, padrão ESC/POS). */
function columnsFor(paperWidth: '58mm' | '80mm'): number {
  return paperWidth === '80mm' ? 48 : 32
}

class ReceiptBuilder {
  private readonly bytes: number[] = []
  readonly columns: number

  constructor(paperWidth: '58mm' | '80mm') {
    this.columns = columnsFor(paperWidth)
    this.bytes.push(ESC, 0x40) // ESC @ — inicializa a impressora
    this.bytes.push(ESC, 0x74, 0x03) // ESC t 3 — code page PC860 (Português)
  }

  align(align: Align): this {
    this.bytes.push(ESC, 0x61, ALIGN_CODE[align])
    return this
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0)
    return this
  }

  /** GS ! n — tamanho do texto (1 a 8 vezes largura/altura normal). */
  size(width: number, height: number): this {
    const w = Math.min(Math.max(width, 1), 8)
    const h = Math.min(Math.max(height, 1), 8)
    this.bytes.push(GS, 0x21, ((w - 1) << 4) | (h - 1))
    return this
  }

  text(value: string): this {
    this.bytes.push(...encodeCp860(value))
    return this
  }

  line(value = ''): this {
    this.text(value)
    this.bytes.push(0x0a)
    return this
  }

  /** Linha com duas colunas: texto à esquerda e à direita, preenchendo a largura do papel. */
  row(left: string, right: string): this {
    const space = Math.max(1, this.columns - left.length - right.length)
    if (left.length + right.length + 1 > this.columns) {
      const maxLeft = Math.max(0, this.columns - right.length - 1)
      return this.line(`${left.slice(0, maxLeft)} ${right}`)
    }
    return this.line(`${left}${' '.repeat(space)}${right}`)
  }

  separator(): this {
    return this.line('-'.repeat(this.columns))
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i += 1) {
      this.bytes.push(0x0a)
    }
    return this
  }

  cut(): this {
    this.bytes.push(GS, 0x56, 0x41, 0x00) // GS V A 0 — corte total
    return this
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}

export function buildReceiptEscPos(sale: Sale, options: ReceiptOptions): Uint8Array {
  const width = options.paperWidth ?? '58mm'
  const builder = new ReceiptBuilder(width)

  builder
    .align('center')
    .bold(true)
    .size(1, 1)
    .line(options.storeName)
    .bold(false)

  if (options.document) {
    builder.line(options.document)
  }
  if (options.address) {
    builder.line(options.address)
  }
  builder.line('Comprovante não fiscal')
  builder.separator()

  builder.align('left')
  builder.row(`Venda #${sale.number}`, formatDateTime(sale.createdAt))
  builder.line(`Operador: ${sale.createdBy.name}`)
  if (sale.customer) {
    builder.line(`Cliente: ${sale.customer.name}`)
  }
  builder.separator()

  for (const item of sale.items) {
    builder.bold(true).line(item.description).bold(false)
    builder.row(
      `  ${Number(item.quantity)} x ${formatBRL(item.unitPrice)}`,
      formatBRL(item.total),
    )
  }
  builder.separator()

  builder.row('Subtotal', formatBRL(sale.subtotal))
  builder.row('Desconto', `- ${formatBRL(sale.discount)}`)
  builder.bold(true).row('TOTAL', formatBRL(sale.total)).bold(false)
  builder.separator()

  builder.bold(true).line('Pagamentos').bold(false)
  for (const payment of sale.payments) {
    const label =
      paymentMethodLabels[payment.method] +
      (payment.installments > 1 ? ` (${payment.installments}x)` : '')
    builder.row(label, formatBRL(payment.amount))
  }
  builder.separator()

  builder
    .align('center')
    .line(options.footer ?? 'Obrigado pela preferência!')
    .feed(3)
    .cut()

  return builder.build()
}

export function buildTestPrintEscPos(paperWidth: '58mm' | '80mm' = '58mm'): Uint8Array {
  const builder = new ReceiptBuilder(paperWidth)
  builder
    .align('center')
    .bold(true)
    .line('Teste de impressão')
    .bold(false)
    .line('Sistema PDV')
    .separator()
    .align('left')
    .line('Acentuação: ção, ã, é, ê, ç, õ')
    .line(formatDateTime(new Date().toISOString()))
    .feed(3)
    .cut()
  return builder.build()
}
