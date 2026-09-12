import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { productsApi, type Category, type Product } from '../lib/catalog';
import { formatBRL } from '../lib/format';
import { Modal } from './Modal';
import { ProductFormModal } from './ProductFormModal';
import { useConfirm } from './ui/useConfirm';
import { useToast } from './ui/useToast';

interface VariantsModalProps {
  open: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}

export function VariantsModal({
  open,
  product,
  categories,
  onClose,
  onChanged,
}: VariantsModalProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [variants, setVariants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = useCallback(async () => {
    if (!product) {
      return;
    }
    setLoading(true);
    try {
      const data = await productsApi.list({
        parentId: product.id,
        pageSize: 100,
      });
      setVariants(data.items);
    } catch {
      toast.error('Erro ao carregar variações');
    } finally {
      setLoading(false);
    }
  }, [product, toast]);

  useEffect(() => {
    if (open && product) {
      void (async () => {
        await load();
      })();
    }
  }, [open, product, load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(variant: Product) {
    setEditing(variant);
    setFormOpen(true);
  }

  async function handleDelete(variant: Product) {
    const ok = await confirm({
      title: 'Excluir variação',
      message: `Excluir a variação "${variant.variantName}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) {
      return;
    }
    try {
      await productsApi.remove(variant.id);
      toast.success('Variação excluída.');
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <>
      <Modal
        open={open && !formOpen}
        title={product ? `Variações — ${product.name}` : 'Variações'}
        onClose={onClose}
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Nova variação
          </button>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Variação</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2 text-right">Estoque</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && variants.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Nenhuma variação cadastrada.
                    </td>
                  </tr>
                )}
                {!loading &&
                  variants.map((variant) => (
                    <tr key={variant.id}>
                      <td className="px-3 py-2 text-slate-800">
                        {variant.variantName}
                        <p className="text-xs text-slate-400">
                          {variant.barcode || variant.sku || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatBRL(variant.price)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {Number(variant.stock)} {variant.unit}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(variant)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(variant)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ProductFormModal
        open={formOpen}
        product={editing}
        categories={categories}
        parentProduct={product}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          toast.success('Variação salva.');
          load();
          onChanged();
        }}
      />
    </>
  );
}
