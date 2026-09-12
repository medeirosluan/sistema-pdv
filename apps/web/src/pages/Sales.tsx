import { Eye, Printer, Receipt, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ui/useConfirm';
import { useToast } from '../components/ui/useToast';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { formatBRL, formatDateTime } from '../lib/format';
import { useCan } from '../lib/permissions';
import { printReceipt } from '../lib/receipt';
import {
  paymentMethodLabels,
  salesApi,
  type Sale,
  type SaleStatus,
} from '../lib/sales';

const statusLabels: Record<SaleStatus, string> = {
  OPEN: 'Aberta',
  FINISHED: 'Finalizada',
  CANCELED: 'Cancelada',
};

const statusClasses: Record<SaleStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  FINISHED: 'bg-brand-100 text-brand-700',
  CANCELED: 'bg-red-100 text-red-700',
};

const PAGE_SIZE = 10;

export function Sales() {
  const { user } = useAuth();
  const can = useCan();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | SaleStatus>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await salesApi.list({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar vendas',
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleCancel(sale: Sale) {
    const ok = await confirm({
      title: 'Cancelar venda',
      message: `Cancelar a venda #${sale.number}? O estoque será devolvido.`,
      confirmLabel: 'Cancelar venda',
      danger: true,
    });
    if (!ok) {
      return;
    }
    try {
      await salesApi.cancel(sale.id);
      setSelected(null);
      toast.success('Venda cancelada.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao cancelar');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Vendas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Histórico de vendas da sua loja.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | SaleStatus);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
        >
          <option value="">Todas as situações</option>
          <option value="FINISHED">Finalizadas</option>
          <option value="CANCELED">Canceladas</option>
          <option value="OPEN">Abertas</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Venda</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-center">Itens</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Situação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Nenhuma venda encontrada.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    #{sale.number}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {sale.customer?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {sale.items.length}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatBRL(sale.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[sale.status]}`}
                    >
                      {statusLabels[sale.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSelected(sale)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {sale.status !== 'CANCELED' && can('sales.cancel') && (
                        <button
                          type="button"
                          onClick={() => handleCancel(sale)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} venda(s) · página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>

      <Modal
        open={selected !== null}
        title={selected ? `Venda #${selected.number}` : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Receipt className="h-4 w-4" />
              {formatDateTime(selected.createdAt)} · por{' '}
              {selected.createdBy.name}
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {selected.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {item.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatBRL(item.unitPrice)} × {Number(item.quantity)}
                    </p>
                  </div>
                  <span className="font-medium text-slate-800">
                    {formatBRL(item.total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatBRL(selected.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Desconto</span>
                <span>- {formatBRL(selected.discount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatBRL(selected.total)}</span>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Pagamentos
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.payments.map((payment) => (
                  <span
                    key={payment.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {paymentMethodLabels[payment.method]}:{' '}
                    {formatBRL(payment.amount)}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                printReceipt(selected, {
                  storeName: user?.tenant.name ?? 'Loja',
                  document: user?.tenant.document,
                  address: user?.tenant.address,
                  footer: user?.tenant.settings?.receiptFooter,
                  paperWidth: user?.tenant.settings?.receiptWidth,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Imprimir cupom
            </button>

            {selected.status !== 'CANCELED' && can('sales.cancel') && (
              <button
                type="button"
                onClick={() => handleCancel(selected)}
                className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                Cancelar venda
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
