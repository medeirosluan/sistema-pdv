import {
  AlertTriangle,
  ArrowUpRight,
  DollarSign,
  Package,
  Receipt,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { formatBRL, formatDateTime } from '../lib/format';
import {
  reportsApi,
  type DashboardSummary,
  type SalesReport,
} from '../lib/reports';
import { paymentMethodLabels } from '../lib/sales';
import { useAuth } from '../lib/auth';

const quickActions = [
  {
    to: '/pdv',
    label: 'Abrir PDV',
    description: 'Inicie uma nova venda',
    icon: ShoppingCart,
  },
  {
    to: '/produtos',
    label: 'Cadastrar produto',
    description: 'Adicione itens ao catálogo',
    icon: Package,
  },
  {
    to: '/caixa',
    label: 'Abrir caixa',
    description: 'Inicie o turno de trabalho',
    icon: DollarSign,
  },
];

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([reportsApi.summary(), reportsApi.sales()])
      .then(([summaryData, reportData]) => {
        setSummary(summaryData);
        setReport(reportData);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : 'Erro ao carregar o resumo',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const maxDay = Math.max(
    ...(summary?.salesByDay.map((day) => day.total) ?? [0]),
    1,
  );
  const maxPayment = Math.max(
    ...(report?.byPayment.map((payment) => payment.total) ?? [0]),
    1,
  );

  const stats: {
    label: string;
    value: string;
    icon: LucideIcon;
    hint: string;
    tone: string;
  }[] = summary
    ? [
        {
          label: 'Vendas hoje',
          value: formatBRL(summary.today.total),
          icon: DollarSign,
          hint: `${summary.today.count} venda(s)`,
          tone: 'bg-brand-100 text-brand-600',
        },
        {
          label: 'Vendas no mês',
          value: formatBRL(summary.month.total),
          icon: Receipt,
          hint: `${summary.month.count} venda(s)`,
          tone: 'bg-sky-100 text-sky-600',
        },
        {
          label: 'Ticket médio',
          value: formatBRL(summary.averageTicket),
          icon: ShoppingCart,
          hint: 'média do mês',
          tone: 'bg-violet-100 text-violet-600',
        },
        {
          label: 'Produtos',
          value: String(summary.products.total),
          icon: Package,
          hint: `${summary.products.lowStock} com estoque baixo`,
          tone: 'bg-amber-100 text-amber-600',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Olá, {user?.name.split(' ')[0]}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Este é o resumo da sua loja.
        </p>
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
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        {!loading &&
          stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {stat.label}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}
                >
                  <stat.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{stat.hint}</p>
            </div>
          ))}
      </div>

      {summary && summary.products.lowStock > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {summary.products.lowStock} produto(s) com estoque baixo (≤ 5).
          </span>
          <Link
            to="/produtos"
            className="ml-auto font-medium text-amber-900 hover:underline"
          >
            Ver produtos
          </Link>
        </div>
      )}

      {report && report.byPayment.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Formas de pagamento (30 dias)
          </h3>
          <div className="mt-4 space-y-3">
            {report.byPayment.map((payment) => {
              const percent = Math.round(
                (payment.total / maxPayment) * 100,
              );
              return (
                <div key={payment.method}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {paymentMethodLabels[payment.method]}
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatBRL(payment.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <h3 className="text-base font-semibold text-slate-900">
            Vendas nos últimos 7 dias
          </h3>
          <div className="mt-6 flex h-48 items-end gap-3">
            {summary?.salesByDay.map((day) => (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-brand-500/80 transition hover:bg-brand-600"
                    style={{
                      height: `${Math.max((day.total / maxDay) * 100, 2)}%`,
                    }}
                    title={formatBRL(day.total)}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {dayLabel(day.date)}
                </span>
              </div>
            ))}
            {!summary && (
              <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Últimas vendas
            </h3>
            <Link
              to="/vendas"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todas
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {summary && summary.recentSales.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">
                Nenhuma venda registrada.
              </li>
            )}
            {summary?.recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    #{sale.number}
                  </p>
                  <p className="text-xs text-slate-400">
                    {sale.customer?.name ?? 'Consumidor'} ·{' '}
                    {formatDateTime(sale.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {formatBRL(sale.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">
              Ações rápidas
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-500 hover:bg-brand-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white transition group-hover:bg-brand-600">
                    <action.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {action.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Primeiros passos
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              'Cadastrar categorias e produtos',
              'Cadastrar seus clientes',
              'Abrir o caixa do turno',
              'Registrar a primeira venda',
            ].map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span className="text-slate-600">{step}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/pdv"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Ir para o PDV
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
