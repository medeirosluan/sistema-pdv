import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import { formatBRL } from '../lib/format';
import { reportsApi, type SalesReport } from '../lib/reports';
import { paymentMethodLabels } from '../lib/sales';

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

const initialTo = toInputDate(new Date());
const initialFrom = toInputDate(
  new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
);

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function Reports() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await reportsApi.sales({ from, to }));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar relatório',
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const maxDay = Math.max(
    ...(report?.byDay.map((day) => day.total) ?? [0]),
    1,
  );

  function exportProducts() {
    if (!report) {
      return;
    }
    downloadCsv(`produtos_${from}_a_${to}.csv`, [
      ['Produto', 'Quantidade', 'Total (R$)'],
      ...report.byProduct.map((product) => [
        product.description,
        product.quantity,
        product.total.toFixed(2).replace('.', ','),
      ]),
    ]);
  }

  function exportPayments() {
    if (!report) {
      return;
    }
    downloadCsv(`pagamentos_${from}_a_${to}.csv`, [
      ['Forma de pagamento', 'Vendas', 'Total (R$)'],
      ...report.byPayment.map((payment) => [
        paymentMethodLabels[payment.method],
        payment.count,
        payment.total.toFixed(2).replace('.', ','),
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Relatórios</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vendas por período, forma de pagamento e produto.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Até</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        {!loading &&
          report &&
          [
            {
              label: 'Faturamento líquido',
              value: formatBRL(report.totals.netTotal),
            },
            { label: 'Vendas', value: String(report.totals.count) },
            {
              label: 'Ticket médio',
              value: formatBRL(report.totals.averageTicket),
            },
            {
              label: 'Descontos',
              value: formatBRL(report.totals.discountTotal),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Faturamento por dia
        </h3>
        <div className="mt-6 flex h-40 items-end gap-1 overflow-x-auto">
          {report?.byDay.length === 0 && (
            <p className="w-full py-10 text-center text-sm text-slate-400">
              Nenhuma venda no período.
            </p>
          )}
          {report?.byDay.map((day) => (
            <div
              key={day.date}
              className="flex min-w-6 flex-1 flex-col items-center gap-2"
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-brand-500/80"
                  style={{
                    height: `${Math.max((day.total / maxDay) * 100, 2)}%`,
                  }}
                  title={`${dayLabel(day.date)}: ${formatBRL(day.total)}`}
                />
              </div>
              <span className="whitespace-nowrap text-[10px] text-slate-400">
                {dayLabel(day.date)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Por forma de pagamento
            </h3>
            <button
              type="button"
              onClick={exportPayments}
              disabled={!report || report.byPayment.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Forma</th>
                <th className="px-5 py-3 text-center">Vendas</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report?.byPayment.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-slate-400"
                  >
                    Sem dados.
                  </td>
                </tr>
              )}
              {report?.byPayment.map((payment) => (
                <tr key={payment.method}>
                  <td className="px-5 py-3 text-slate-700">
                    {paymentMethodLabels[payment.method]}
                  </td>
                  <td className="px-5 py-3 text-center text-slate-600">
                    {payment.count}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">
                    {formatBRL(payment.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Por produto
            </h3>
            <button
              type="button"
              onClick={exportProducts}
              disabled={!report || report.byProduct.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-center">Qtd.</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report?.byProduct.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      Sem dados.
                    </td>
                  </tr>
                )}
                {report?.byProduct.map((product) => (
                  <tr key={product.productId ?? product.description}>
                    <td className="px-5 py-3 text-slate-700">
                      {product.description}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-600">
                      {product.quantity}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatBRL(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
