import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import type { Product } from '../lib/catalog';
import { formatDateTime } from '../lib/format';
import {
  stockApi,
  stockMovementLabels,
  type StockMovement,
  type StockMovementType,
} from '../lib/stock';
import { Modal } from './Modal';

interface StockModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onChanged: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const typeOptions: {
  value: StockMovementType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'IN', label: 'Entrada', icon: ArrowUpCircle },
  { value: 'OUT', label: 'Saída', icon: ArrowDownCircle },
  { value: 'ADJUST', label: 'Ajuste', icon: RefreshCw },
];

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function StockModal({
  open,
  product,
  onClose,
  onChanged,
}: StockModalProps) {
  const [type, setType] = useState<StockMovementType>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = useCallback(async (productId: string) => {
    setLoading(true);
    try {
      const data = await stockApi.movements(productId);
      setMovements(data.items);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !product) {
      return;
    }
    setType('IN');
    setQuantity('');
    setReason('');
    setError(null);
    setCurrentStock(Number(product.stock));
    loadMovements(product.id);
  }, [open, product, loadMovements]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await stockApi.register(product.id, {
        type,
        quantity: parseNumber(quantity),
        reason: reason.trim() || undefined,
      });
      setCurrentStock(Number(result.product.stock));
      setQuantity('');
      setReason('');
      await loadMovements(product.id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível movimentar',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={product ? `Estoque — ${product.name}` : 'Estoque'}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Fechar
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Estoque atual</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {currentStock} {product?.unit}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Estoque mínimo</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {Number(product?.minStock ?? 0)} {product?.unit}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  type === option.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {type === 'ADJUST' ? 'Nova quantidade (contagem)' : 'Quantidade'}
            </span>
            <input
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Motivo
            </span>
            <input
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: compra, perda, inventário"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Registrando...' : 'Registrar movimento'}
          </button>
        </form>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Histórico
          </p>
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-400">
              Carregando...
            </p>
          ) : movements.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              Nenhum movimento registrado.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {stockMovementLabels[movement.type]}{' '}
                      <span className="text-slate-400">
                        ({Number(movement.previousStock)} →{' '}
                        {Number(movement.newStock)})
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(movement.createdAt)} ·{' '}
                      {movement.createdBy.name}
                      {movement.reason ? ` · ${movement.reason}` : ''}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${
                      movement.type === 'OUT'
                        ? 'text-red-600'
                        : movement.type === 'IN'
                          ? 'text-brand-600'
                          : 'text-slate-700'
                    }`}
                  >
                    {movement.type === 'OUT' ? '-' : movement.type === 'IN' ? '+' : '='}
                    {Number(movement.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
