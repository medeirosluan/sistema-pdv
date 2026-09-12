import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { auditApi, type AuditLog } from '../lib/audit';
import { formatDateTime } from '../lib/format';

const PAGE_SIZE = 20;

const actionLabels: Record<string, string> = {
  'auth.login': 'Login',
  'auth.login.failed': 'Login falhou',
  'auth.logout': 'Logout',
  'auth.2fa.enabled': '2FA ativado',
  'auth.2fa.disabled': '2FA desativado',
  'user.create': 'Usuário criado',
  'user.update': 'Usuário alterado',
  'user.delete': 'Usuário excluído',
  'sale.cancel': 'Venda cancelada',
  'tenant.update': 'Configurações alteradas',
  'tenant.plan': 'Plano alterado',
};

function describe(log: AuditLog): string {
  const base = actionLabels[log.action] ?? log.action;
  if (log.entity) {
    return `${base} (${log.entity})`;
  }
  return base;
}

export function Audit() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [prevDebounced, setPrevDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditApi.list({
        page,
        pageSize: PAGE_SIZE,
        action: debounced || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar auditoria',
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  if (debounced !== prevDebounced) {
    setPrevDebounced(debounced);
    setPage(1);
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Auditoria</h2>
        <p className="mt-1 text-sm text-slate-500">
          Registro das ações sensíveis realizadas no sistema.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por ação (ex.: login, user, sale)"
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
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Detalhes</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhum registro.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {describe(log)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.userName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {Object.keys(log.metadata ?? {}).length > 0
                      ? JSON.stringify(log.metadata)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{log.ip ?? '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} registro(s) · página {page} de {totalPages}
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
    </div>
  );
}
