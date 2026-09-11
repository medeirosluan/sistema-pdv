import { X } from 'lucide-react';
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { formatBRL } from '../lib/format';
import { paymentMethodLabels, type PaymentMethod } from '../lib/sales';
import { useHotkeys } from '../lib/useHotkeys';
import { Modal } from './Modal';

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
}

const paymentMethods: PaymentMethod[] = ['CASH', 'PIX', 'CREDIT', 'DEBIT'];

const methodKeys: Record<PaymentMethod, string> = {
  CASH: '1',
  PIX: '2',
  CREDIT: '3',
  DEBIT: '4',
};

export function newPaymentLine(
  method: PaymentMethod = 'CASH',
  amount = '',
): PaymentLine {
  return { id: crypto.randomUUID(), method, amount };
}

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

interface PaymentModalProps {
  open: boolean;
  total: number;
  payments: PaymentLine[];
  submitting: boolean;
  error: string | null;
  onChange: (payments: PaymentLine[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function PaymentModal({
  open,
  total,
  payments,
  submitting,
  error,
  onChange,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const amountRef = useRef<HTMLInputElement>(null);
  const firstMethodRef = useRef<HTMLButtonElement>(null);

  const paid =
    Math.round(
      payments.reduce((sum, payment) => sum + parseNumber(payment.amount), 0) *
        100,
    ) / 100;
  const remaining = Math.round((total - paid) * 100) / 100;
  const change = paid > total ? Math.round((paid - total) * 100) / 100 : 0;
  const canConfirm = paid > 0 && remaining <= 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const timeout = setTimeout(() => firstMethodRef.current?.focus(), 60);
    return () => clearTimeout(timeout);
  }, [open]);

  function setMethod(method: PaymentMethod) {
    onChange(
      payments.length === 0
        ? [newPaymentLine(method)]
        : payments.map((payment, index) =>
            index === 0 ? { ...payment, method } : payment,
          ),
    );
    amountRef.current?.focus();
  }

  function updateLine(id: string, patch: Partial<PaymentLine>) {
    onChange(
      payments.map((payment) =>
        payment.id === id ? { ...payment, ...patch } : payment,
      ),
    );
  }

  function removeLine(id: string) {
    onChange(payments.filter((payment) => payment.id !== id));
  }

  function handleMethodKey(event: KeyboardEvent, method: PaymentMethod) {
    const target = event.target as HTMLElement | null;
    const isTyping =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (isTyping) {
      return;
    }
    event.preventDefault();
    setMethod(method);
  }

  useHotkeys(
    {
      '1': (event) => handleMethodKey(event, 'CASH'),
      '2': (event) => handleMethodKey(event, 'PIX'),
      '3': (event) => handleMethodKey(event, 'CREDIT'),
      '4': (event) => handleMethodKey(event, 'DEBIT'),
    },
    open,
  );

  function handleAmountKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && canConfirm && !submitting) {
      event.preventDefault();
      onConfirm();
    }
  }

  const activeMethod = payments[0]?.method ?? 'CASH';

  return (
    <Modal
      open={open}
      title="Pagamento"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || submitting}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Finalizando...' : 'Finalizar (F9)'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-900 px-4 py-3 text-center text-white">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Total a pagar
          </p>
          <p className="text-3xl font-bold">{formatBRL(total)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map((method, index) => (
            <button
              key={method}
              type="button"
              ref={index === 0 ? firstMethodRef : undefined}
              onClick={() => setMethod(method)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                activeMethod === method && payments.length === 1
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{paymentMethodLabels[method]}</span>
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 text-xs text-slate-500">
                {methodKeys[method]}
              </kbd>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {payments.map((payment, index) => (
            <div key={payment.id} className="flex items-center gap-2">
              <select
                value={payment.method}
                onChange={(e) =>
                  updateLine(payment.id, {
                    method: e.target.value as PaymentMethod,
                  })
                }
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </select>
              <input
                ref={index === 0 ? amountRef : undefined}
                value={payment.amount}
                onChange={(e) =>
                  updateLine(payment.id, { amount: e.target.value })
                }
                onKeyDown={handleAmountKeyDown}
                placeholder="0,00"
                inputMode="decimal"
                className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm outline-none focus:border-brand-500"
              />
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(payment.id)}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Pago</span>
            <span className="font-medium text-slate-700">
              {formatBRL(paid)}
            </span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Falta</span>
              <span className="font-semibold text-red-600">
                {formatBRL(remaining)}
              </span>
            </div>
          )}
          {change > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Troco</span>
              <span className="font-semibold text-slate-900">
                {formatBRL(change)}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
