import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { categoriesApi, type Category } from '../lib/catalog';
import { Modal } from './Modal';

interface CategoriesModalProps {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function CategoriesModal({
  open,
  categories,
  onClose,
  onChanged,
}: CategoriesModalProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setNewName('');
    setEditingId(null);
    setEditingName('');
    setError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await categoriesApi.create(newName.trim());
      setNewName('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar');
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await categoriesApi.update(id, editingName.trim());
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao renomear');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(category: Category) {
    const count = category._count?.products ?? 0;
    const message =
      count > 0
        ? `A categoria "${category.name}" tem ${count} produto(s). Eles ficarão sem categoria. Continuar?`
        : `Excluir a categoria "${category.name}"?`;
    if (!window.confirm(message)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await categoriesApi.remove(category.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Categorias"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Fechar
        </button>
      }
    >
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className={inputClass}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova categoria"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {categories.length === 0 && (
          <li className="py-6 text-center text-sm text-slate-400">
            Nenhuma categoria cadastrada
          </li>
        )}
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 py-2.5"
          >
            {editingId === category.id ? (
              <>
                <input
                  className={inputClass}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleRename(category.id)}
                  disabled={busy}
                  className="rounded-lg p-2 text-brand-600 transition hover:bg-brand-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">
                  {category.name}
                  <span className="ml-2 text-xs text-slate-400">
                    {category._count?.products ?? 0} produto(s)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditingName(category.name);
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(category)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
