import { buildReceiptEscPos } from './escpos';
import { formatBRL, formatDateTime } from './format';
import { getPreferredPrinter } from './printerSettings';
import { paymentMethodLabels, type Sale } from './sales';
import { isTauri, printRaw } from './tauri';

export interface ReceiptOptions {
  storeName: string;
  document?: string | null;
  address?: string | null;
  footer?: string;
  paperWidth?: '58mm' | '80mm';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function money(value: string | number | null | undefined): string {
  return formatBRL(value).replace(/\s/g, ' ');
}

export function buildReceiptHtml(sale: Sale, options: ReceiptOptions): string {
  const width = options.paperWidth ?? '58mm';
  const store = escapeHtml(options.storeName);
  const footer = escapeHtml(
    options.footer ?? 'Obrigado pela preferência!',
  );
  const documentLine = options.document
    ? `<div>${escapeHtml(options.document)}</div>`
    : '';
  const addressLine = options.address
    ? `<div>${escapeHtml(options.address)}</div>`
    : '';

  const items = sale.items
    .map(
      (item) => `
      <div class="item">
        <div class="desc">${escapeHtml(item.description)}</div>
        <div class="row">
          <span>${Number(item.quantity)} x ${money(item.unitPrice)}</span>
          <span>${money(item.total)}</span>
        </div>
      </div>`,
    )
    .join('');

  const payments = sale.payments
    .map(
      (payment) => `
      <div class="row">
        <span>${escapeHtml(paymentMethodLabels[payment.method])}${
          payment.installments > 1 ? ` (${payment.installments}x)` : ''
        }</span>
        <span>${money(payment.amount)}</span>
      </div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Cupom #${sale.number}</title>
<style>
  @page { size: ${width} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
    width: ${width};
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .store { font-size: 14px; font-weight: bold; }
  .muted { font-size: 10px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .item { margin-bottom: 4px; }
  .item .desc { font-weight: bold; }
  .item .row { padding-left: 8px; }
  .totals .row { font-size: 12px; }
  .grand { font-size: 14px; font-weight: bold; }
  .header { margin-bottom: 6px; }
</style>
</head>
<body>
  <div class="header center">
    <div class="store">${store}</div>
    ${documentLine}
    ${addressLine}
    <div class="muted">Comprovante não fiscal</div>
  </div>

  <div class="sep"></div>

  <div class="row"><span>Venda #${sale.number}</span><span>${escapeHtml(
    formatDateTime(sale.createdAt),
  )}</span></div>
  <div>Operador: ${escapeHtml(sale.createdBy.name)}</div>
  ${
    sale.customer
      ? `<div>Cliente: ${escapeHtml(sale.customer.name)}</div>`
      : ''
  }

  <div class="sep"></div>

  ${items}

  <div class="sep"></div>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
    <div class="row"><span>Desconto</span><span>- ${money(sale.discount)}</span></div>
    <div class="row grand"><span>TOTAL</span><span>${money(sale.total)}</span></div>
  </div>

  <div class="sep"></div>

  <div class="bold">Pagamentos</div>
  ${payments}

  <div class="sep"></div>

  <div class="center muted">${footer}</div>
</body>
</html>`;
}

export function printReceipt(sale: Sale, options: ReceiptOptions): void {
  if (isTauri()) {
    const data = buildReceiptEscPos(sale, options);
    printRaw(getPreferredPrinter(), data).catch((err) => {
      console.error('Falha ao imprimir cupom na impressora térmica:', err);
      window.alert(
        'Não foi possível imprimir o cupom. Verifique a impressora nas Configurações.',
      );
    });
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(buildReceiptHtml(sale, options));
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  iframe.onload = () => {
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(cleanup, 1000);
    }, 200);
  };
}
