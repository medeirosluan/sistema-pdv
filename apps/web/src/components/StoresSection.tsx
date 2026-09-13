import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { storesApi, type Store } from '../lib/stores';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function StoresSection() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setStores(await storesApi.list());
    } catch {
      // silencioso — a lista fica vazia
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await storesApi.create({ name: name.trim(), slug: slugify(name) });
      setName('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível criar a loja',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(store: Store) {
    await storesApi.update(store.id, { active: !store.active });
    await load();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-base font-semibold text-slate-900">Lojas</h3>
      <p className="mt-1 text-sm text-slate-500">
        Gerencie as lojas/filiais desta conta. Cada usuário fica vinculado a
        uma única loja.
      </p>

      {!loading && (
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {store.name}
                </p>
                <p className="text-xs text-slate-400">{store.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    store.active
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {store.active ? 'Ativa' : 'Inativa'}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActive(store)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {store.active ? 'Inativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex items-end gap-3">
        <label className="block flex-1">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Nova loja
          </span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Loja Centro"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Criando...' : 'Adicionar loja'}
        </button>
      </form>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
