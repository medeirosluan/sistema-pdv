import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  adminApi,
  planLabels,
  statusLabels,
  type AdminSummary,
  type AdminTenant,
  type TenantPlanKey,
  type TenantStatus,
} from '../lib/admin';
import { formatDateTime } from '../lib/format';

const PAGE_SIZE = 10;
const planOptions: TenantPlanKey[] = ['FREE', 'BASIC', 'PRO'];
const statusOptions: TenantStatus[] = ['ACTIVE', 'SUSPENDED', 'CANCELED'];

export function Admin() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [items, setItems] = useState<AdminTenant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await adminApi.summary());
    } catch {
      // resumo é auxiliar
    }
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.tenants({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar lojas',
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
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function updateTenant(
    id: string,
    input: { plan?: TenantPlanKey; status?: TenantStatus },
  ) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.updateTenant(id, input);
      await Promise.all([loadTenants(), loadSummary()]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao atualizar loja',
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!user?.platformAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          Acesso restrito ao administrador da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Painel da plataforma
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie as lojas (tenants), planos e situação.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Lojas', value: summary?.tenants },
          { label: 'Lojas ativas', value: summary?.activeTenants },
          { label: 'Usuários', value: summary?.users },
          { label: 'Produtos', value: summary?.products },
          { label: 'Vendas', value: summary?.sales },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {stat.value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou identificador"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Loja</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-center">Usuários</th>
              <th className="px-4 py-3 text-center">Produtos</th>
              <th className="px-4 py-3 text-center">Vendas</th>
              <th className="px-4 py-3">Criada em</th>
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
                  Nenhuma loja encontrada.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((tenant) => (
                <tr
                  key={tenant.id}
                  className={busyId === tenant.id ? 'opacity-60' : ''}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {tenant.name}
                    </p>
                    <p className="text-xs text-slate-400">{tenant.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={tenant.plan}
                      onChange={(e) =>
                        updateTenant(tenant.id, {
                          plan: e.target.value as TenantPlanKey,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500"
                    >
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>
                          {planLabels[plan]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={tenant.status}
                      onChange={(e) =>
                        updateTenant(tenant.id, {
                          status: e.target.value as TenantStatus,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {tenant._count.users}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {tenant._count.products}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {tenant._count.sales}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(tenant.createdAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} loja(s) · página {page} de {totalPages}
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
