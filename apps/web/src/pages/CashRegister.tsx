import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Unlock,
  Wallet,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { useConfirm } from '../components/ui/useConfirm';
import { useToast } from '../components/ui/useToast';
import {
  addPendingCashMovement,
  getPendingCashClose,
  getPendingCashOpen,
  listPendingCashMovements,
  setPendingCashClose,
  setPendingCashOpen,
} from '../lib/offline/cashQueue';
import { getMeta, setMeta } from '../lib/offline/db';
import { onPendingChanged } from '../lib/offline/salesQueue';
import { useHotkeys } from '../lib/useHotkeys';
import {
  cashApi,
  cashMovementLabels,
  type CashMovementType,
  type CashRegister as CashRegisterModel,
  type CloseResult,
  type CurrentCashRegister,
} from '../lib/cash';
import { formatBRL, formatDateTime } from '../lib/format';
import { paymentMethodLabels, type PaymentMethod } from '../lib/sales';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const methodOrder: PaymentMethod[] = ['CASH', 'PIX', 'CREDIT', 'DEBIT'];

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function withPendingMovements(
  tenantId: string,
  data: CurrentCashRegister | null,
): Promise<CurrentCashRegister | null> {
  if (!data) {
    return data;
  }
  const pending = await listPendingCashMovements(tenantId);
  if (pending.length === 0) {
    return data;
  }
  return {
    ...data,
    register: {
      ...data.register,
      movements: [
        ...data.register.movements,
        ...pending.map((movement) => ({
          id: movement.clientId,
          type: movement.type,
          amount: movement.amount,
          reason: movement.reason ?? null,
          createdAt: movement.createdAt,
          pending: true,
        })),
      ],
    },
  };
}

/**
 * Sobrepõe abertura/fechamento de caixa feitos offline (ainda não
 * sincronizados) ao último estado conhecido do servidor. Uma abertura
 * pendente substitui o dado em cache (mesmo se o servidor disser que está
 * fechado) porque, do ponto de vista do operador, o turno já começou; um
 * fechamento pendente faz o caixa aparecer como fechado imediatamente,
 * mesmo antes de a requisição real chegar ao servidor.
 */
async function withPendingCashSession(
  tenantId: string,
  data: CurrentCashRegister | null,
  currentUser: { id: string; name: string } | null,
): Promise<CurrentCashRegister | null> {
  const pendingClose = await getPendingCashClose(tenantId);
  if (pendingClose) {
    return null;
  }

  let base = data;
  const pendingOpen = await getPendingCashOpen(tenantId);
  if (pendingOpen) {
    base = {
      register: {
        id: `pending-open:${pendingOpen.clientId}`,
        status: 'OPEN',
        openingAmount: pendingOpen.openingAmount,
        closingAmount: null,
        openedAt: pendingOpen.createdAt,
        closedAt: null,
        openedBy: { id: currentUser?.id ?? '', name: currentUser?.name ?? '' },
        movements: [],
      },
      summary: {
        salesCount: 0,
        salesTotal: 0,
        byMethod: { CASH: 0, PIX: 0, CREDIT: 0, DEBIT: 0 },
        deposits: 0,
        withdrawals: 0,
        expectedCash: pendingOpen.openingAmount,
      },
    };
  }

  return withPendingMovements(tenantId, base);
}

export function CashRegister() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [current, setCurrent] = useState<CurrentCashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CashRegisterModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [movementType, setMovementType] =
    useState<CashMovementType>('WITHDRAWAL');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const loadCurrent = useCallback(async () => {
    const tenantId = user?.tenant.id ?? '';
    const currentUser = user ? { id: user.id, name: user.name } : null;
    try {
      if (!navigator.onLine) {
        const cached = await getMeta(`cashCurrent:${tenantId}`);
        const data = cached
          ? (JSON.parse(cached) as CurrentCashRegister | null)
          : null;
        setCurrent(await withPendingCashSession(tenantId, data, currentUser));
        return;
      }
      const data = await cashApi.current();
      await setMeta(`cashCurrent:${tenantId}`, JSON.stringify(data));
      setCurrent(await withPendingCashSession(tenantId, data, currentUser));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar o caixa',
      );
    }
  }, [user]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await cashApi.history(1, 10);
      setHistory(data.items);
    } catch {
      // histórico é auxiliar
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadCurrent(), loadHistory()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCurrent, loadHistory]);

  useEffect(() => {
    // quando uma sincronização em segundo plano (ex.: ao voltar a ficar
    // online) altera a fila de movimentos pendentes, atualiza o resumo do
    // caixa para refletir o que já foi sincronizado.
    return onPendingChanged(() => {
      void loadCurrent();
    });
  }, [loadCurrent]);

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const tenantId = user?.tenant.id ?? '';
    const amount = parseNumber(openingAmount);
    const clientId = crypto.randomUUID();
    try {
      if (!navigator.onLine) {
        throw new TypeError('offline');
      }
      await cashApi.open(amount, clientId);
      setOpeningAmount('');
      await loadCurrent();
      await loadHistory();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // sem rede: abre localmente e enfileira para sincronizar depois,
        // igual ao fluxo de vendas e sangrias/suprimentos do PDV.
        await setPendingCashOpen({
          clientId,
          tenantId,
          openingAmount: amount,
          createdAt: new Date().toISOString(),
        });
        setOpeningAmount('');
        toast.info('Caixa aberto offline. Será sincronizado quando a conexão voltar.');
        await loadCurrent();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const tenantId = user?.tenant.id ?? '';
    const amount = parseNumber(movementAmount);
    const reason = movementReason.trim() || undefined;
    const clientId = crypto.randomUUID();
    try {
      if (!navigator.onLine) {
        throw new TypeError('offline');
      }
      await cashApi.addMovement({ clientId, type: movementType, amount, reason });
      setMovementAmount('');
      setMovementReason('');
      await loadCurrent();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // sem rede (ou request falhou mesmo com navigator.onLine): enfileira
        // para sincronizar depois, igual ao fluxo de vendas do PDV.
        await addPendingCashMovement({
          clientId,
          tenantId,
          type: movementType,
          amount,
          reason,
          createdAt: new Date().toISOString(),
        });
        setMovementAmount('');
        setMovementReason('');
        await loadCurrent();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await confirm({
      title: 'Fechar caixa',
      message: 'Fechar o caixa? Esta ação encerra o turno.',
      confirmLabel: 'Fechar caixa',
      danger: true,
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    setError(null);
    const tenantId = user?.tenant.id ?? '';
    const amount = parseNumber(closingAmount);
    const clientId = crypto.randomUUID();
    try {
      if (!navigator.onLine) {
        throw new TypeError('offline');
      }
      const result = await cashApi.close(amount, clientId);
      setCloseResult(result);
      setClosingAmount('');
      toast.success('Caixa fechado.');
      await loadCurrent();
      await loadHistory();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // sem rede: fecha localmente e enfileira para sincronizar depois.
        await setPendingCashClose({
          clientId,
          tenantId,
          closingAmount: amount,
          createdAt: new Date().toISOString(),
        });
        setClosingAmount('');
        toast.info('Caixa fechado offline. Será sincronizado quando a conexão voltar.');
        await loadCurrent();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Caixa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Abra o caixa, registre sangrias/suprimentos e feche o turno.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {closeResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Caixa fechado
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Valor esperado</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatBRL(closeResult.summary.expectedCash)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Valor informado</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatBRL(closeResult.register.closingAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Diferença</p>
              <p
                className={`text-lg font-semibold ${
                  closeResult.difference === 0
                    ? 'text-slate-900'
                    : 'text-red-600'
                }`}
              >
                {formatBRL(closeResult.difference)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCloseResult(null)}
            className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Fechar aviso
          </button>
        </div>
      )}

      {!current ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Unlock className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Caixa fechado
              </h3>
              <p className="text-sm text-slate-500">
                Informe o valor inicial para abrir o turno.
              </p>
            </div>
          </div>
          <form onSubmit={handleOpen} className="mt-5 flex max-w-sm gap-2">
            <input
              className={inputClass}
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="Valor de abertura"
              inputMode="decimal"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              Abrir caixa
            </button>
          </form>
        </div>
      ) : (
        <CashOpenPanel
          data={current}
          busy={busy}
          closingAmount={closingAmount}
          onClosingAmountChange={setClosingAmount}
          movementType={movementType}
          onMovementTypeChange={setMovementType}
          movementAmount={movementAmount}
          onMovementAmountChange={setMovementAmount}
          movementReason={movementReason}
          onMovementReasonChange={setMovementReason}
          onAddMovement={handleAddMovement}
          onClose={handleClose}
        />
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Histórico de caixas
        </h3>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Abertura</th>
                <th className="px-4 py-3">Fechamento</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3 text-right">Abertura</th>
                <th className="px-4 py-3 text-right">Fechamento</th>
                <th className="px-4 py-3 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhum caixa registrado.
                  </td>
                </tr>
              )}
              {history.map((register) => (
                <tr key={register.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(register.openedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(register.closedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {register.openedBy.name}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatBRL(register.openingAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {register.closingAmount === null
                      ? '—'
                      : formatBRL(register.closingAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        register.status === 'OPEN'
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {register.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface CashOpenPanelProps {
  data: CurrentCashRegister;
  busy: boolean;
  closingAmount: string;
  onClosingAmountChange: (value: string) => void;
  movementType: CashMovementType;
  onMovementTypeChange: (value: CashMovementType) => void;
  movementAmount: string;
  onMovementAmountChange: (value: string) => void;
  movementReason: string;
  onMovementReasonChange: (value: string) => void;
  onAddMovement: (event: FormEvent<HTMLFormElement>) => void;
  onClose: (event: FormEvent<HTMLFormElement>) => void;
}

function CashOpenPanel({
  data,
  busy,
  closingAmount,
  onClosingAmountChange,
  movementType,
  onMovementTypeChange,
  movementAmount,
  onMovementAmountChange,
  movementReason,
  onMovementReasonChange,
  onAddMovement,
  onClose,
}: CashOpenPanelProps) {
  const { register, summary } = data;
  const closingValue = parseNumber(closingAmount);
  const difference =
    closingAmount.trim() === ''
      ? null
      : Math.round((closingValue - summary.expectedCash) * 100) / 100;
  const amountRef = useRef<HTMLInputElement>(null);

  useHotkeys({
    s: (event) => {
      if (event.altKey) {
        event.preventDefault();
        onMovementTypeChange('WITHDRAWAL');
        amountRef.current?.focus();
      }
    },
    u: (event) => {
      if (event.altKey) {
        event.preventDefault();
        onMovementTypeChange('DEPOSIT');
        amountRef.current?.focus();
      }
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Caixa aberto
              </h3>
              <p className="text-sm text-slate-500">
                por {register.openedBy.name} · {formatDateTime(register.openedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {register.id.startsWith('pending-open:') && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                Abertura pendente de sincronização
              </span>
            )}
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
              Em andamento
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Dinheiro na gaveta"
            value={formatBRL(summary.expectedCash)}
            highlight
          />
          <SummaryCard
            label="Vendas no turno"
            value={formatBRL(summary.salesTotal)}
            hint={`${summary.salesCount} venda(s)`}
          />
          <SummaryCard
            label="Suprimentos"
            value={formatBRL(summary.deposits)}
          />
          <SummaryCard
            label="Sangrias"
            value={formatBRL(summary.withdrawals)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {methodOrder.map((method) => (
            <span
              key={method}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {paymentMethodLabels[method]}: {formatBRL(summary.byMethod[method])}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Sangria / Suprimento
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Atalhos: Alt+S sangria · Alt+U suprimento
          </p>
          <form onSubmit={onAddMovement} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onMovementTypeChange('WITHDRAWAL')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  movementType === 'WITHDRAWAL'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Sangria
              </button>
              <button
                type="button"
                onClick={() => onMovementTypeChange('DEPOSIT')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  movementType === 'DEPOSIT'
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpCircle className="h-4 w-4" />
                Suprimento
              </button>
            </div>
            <input
              ref={amountRef}
              className={inputClass}
              value={movementAmount}
              onChange={(e) => onMovementAmountChange(e.target.value)}
              placeholder="Valor"
              inputMode="decimal"
              required
            />
            <input
              className={inputClass}
              value={movementReason}
              onChange={(e) => onMovementReasonChange(e.target.value)}
              placeholder="Motivo (opcional)"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              Registrar movimento
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Fechar caixa</h3>
          <form onSubmit={onClose} className="mt-4 space-y-3">
            <div>
              <span className="mb-1.5 block text-sm text-slate-500">
                Valor esperado na gaveta
              </span>
              <p className="text-lg font-semibold text-slate-900">
                {formatBRL(summary.expectedCash)}
              </p>
            </div>
            <input
              className={inputClass}
              value={closingAmount}
              onChange={(e) => onClosingAmountChange(e.target.value)}
              placeholder="Valor contado"
              inputMode="decimal"
              required
            />
            {difference !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Diferença</span>
                <span
                  className={`font-semibold ${
                    difference === 0 ? 'text-slate-900' : 'text-red-600'
                  }`}
                >
                  {formatBRL(difference)}
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              Fechar caixa
            </button>
          </form>
        </div>
      </div>

      {register.movements.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Movimentos do turno
          </h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {register.movements.map((movement) => (
              <li
                key={movement.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {cashMovementLabels[movement.type]}
                    {movement.pending && (
                      <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        pendente
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(movement.createdAt)}
                    {movement.reason ? ` · ${movement.reason}` : ''}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    movement.type === 'WITHDRAWAL'
                      ? 'text-red-600'
                      : 'text-brand-600'
                  }`}
                >
                  {movement.type === 'WITHDRAWAL' ? '-' : '+'}
                  {formatBRL(movement.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-brand-200 bg-brand-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
