import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { ApiError } from '../lib/api';
import { customersApi, type Customer } from '../lib/customers';
import { useCan } from '../lib/permissions';

const PAGE_SIZE = 10;

export function Customers() {
  const can = useCan();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar clientes',
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(customer: Customer) {
    const ok = await confirm({
      title: 'Excluir cliente',
      message: `Excluir o cliente "${customer.name}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) {
      return;
    }
    try {
      await customersApi.remove(customer.id);
      toast.success('Cliente excluído.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Clientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre clientes para vincular às vendas.
          </p>
        </div>
        {can('customers.manage') && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, documento, telefone ou e-mail"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
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
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {customer.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {customer.document || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {customer.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {customer.email || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {can('customers.manage') && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(customer)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(customer)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} cliente(s) · página {page} de {totalPages}
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

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          toast.success('Cliente salvo.');
          load();
        }}
      />
    </div>
  );
}
