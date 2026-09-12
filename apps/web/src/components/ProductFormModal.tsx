import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import {
  productsApi,
  type Category,
  type Product,
  type ProductInput,
} from '../lib/catalog';
import { Modal } from './Modal';

interface ProductFormModalProps {
  open: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  unit: string;
  stock: string;
  minStock: string;
  categoryId: string;
  active: boolean;
}

const emptyForm: FormState = {
  name: '',
  sku: '',
  barcode: '',
  price: '',
  cost: '',
  unit: 'UN',
  stock: '0',
  minStock: '0',
  categoryId: '',
  active: true,
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function ProductFormModal({
  open,
  product,
  categories,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetKey = open ? (product?.id ?? 'new') : null;
  const [appliedResetKey, setAppliedResetKey] = useState<string | null>(null);
  if (resetKey !== appliedResetKey) {
    setAppliedResetKey(resetKey);
    if (resetKey !== null) {
      setError(null);
      if (product) {
        setForm({
          name: product.name,
          sku: product.sku ?? '',
          barcode: product.barcode ?? '',
          price: String(product.price),
          cost: product.cost === null ? '' : String(product.cost),
          unit: product.unit,
          stock: String(product.stock),
          minStock: String(product.minStock ?? 0),
          categoryId: product.categoryId ?? '',
          active: product.active,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price: Number(form.price.replace(',', '.')),
      cost: form.cost.trim() ? Number(form.cost.replace(',', '.')) : null,
      unit: form.unit.trim() || 'UN',
      stock: form.stock.trim() ? Number(form.stock.replace(',', '.')) : 0,
      minStock: form.minStock.trim()
        ? Number(form.minStock.replace(',', '.'))
        : 0,
      categoryId: form.categoryId || null,
      active: form.active,
    };

    try {
      if (product) {
        await productsApi.update(product.id, payload);
      } else {
        await productsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível salvar',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={product ? 'Editar produto' : 'Novo produto'}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Nome *
          </span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Preço *
            </span>
            <input
              className={inputClass}
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Custo
            </span>
            <input
              className={inputClass}
              value={form.cost}
              onChange={(e) => update('cost', e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Código de barras
            </span>
            <input
              className={inputClass}
              value={form.barcode}
              onChange={(e) => update('barcode', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              SKU
            </span>
            <input
              className={inputClass}
              value={form.sku}
              onChange={(e) => update('sku', e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Unidade
            </span>
            <input
              className={inputClass}
              value={form.unit}
              onChange={(e) => update('unit', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Estoque
            </span>
            <input
              className={inputClass}
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Estoque mín.
            </span>
            <input
              className={inputClass}
              value={form.minStock}
              onChange={(e) => update('minStock', e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Categoria
          </span>
          <select
            className={inputClass}
            value={form.categoryId}
            onChange={(e) => update('categoryId', e.target.value)}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update('active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700">Produto ativo</span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
