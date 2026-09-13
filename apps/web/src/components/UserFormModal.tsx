import { useEffect, useState, type FormEvent } from 'react';
import type { UserRole } from '../lib/api';
import { ApiError } from '../lib/api';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  rolePermissions,
  type Permission,
} from '../lib/permissions';
import { storesApi, type Store } from '../lib/stores';
import { useAuth } from '../lib/useAuth';
import { usersApi, type ManagedUser } from '../lib/users';
import { Modal } from './Modal';

interface UserFormModalProps {
  open: boolean;
  user: ManagedUser | null;
  canManageOwners: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  permissions: Permission[];
  storeId: string;
}

function emptyForm(defaultStoreId: string): FormState {
  return {
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    active: true,
    permissions: rolePermissions('CASHIER'),
    storeId: defaultStoreId,
  };
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'OWNER', label: 'Proprietário' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'CASHIER', label: 'Operador de caixa' },
];

export function UserFormModal({
  open,
  user,
  canManageOwners,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(currentUser?.store.id ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void storesApi.list().then(setStores).catch(() => setStores([]));
  }, [open]);

  const resetKey = open ? (user?.id ?? 'new') : null;
  const [appliedResetKey, setAppliedResetKey] = useState<string | null>(null);
  if (resetKey !== appliedResetKey) {
    setAppliedResetKey(resetKey);
    if (resetKey !== null) {
      setError(null);
      if (user) {
        setForm({
          name: user.name,
          email: user.email,
          password: '',
          role: user.role,
          active: user.active,
          permissions: user.permissions,
          storeId: user.storeId,
        });
      } else {
        setForm(emptyForm(currentUser?.store.id ?? ''));
      }
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleRoleChange(role: UserRole) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: rolePermissions(role),
    }));
  }

  function togglePermission(permission: Permission, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permission]
        : prev.permissions.filter((item) => item !== permission),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (user) {
        await usersApi.update(user.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          active: form.active,
          permissions: form.permissions,
          storeId: form.storeId,
        });
      } else {
        await usersApi.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          permissions: form.permissions,
          storeId: form.storeId,
        });
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
      title={user ? 'Editar usuário' : 'Novo usuário'}
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
            form="user-form"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            E-mail *
          </span>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
          />
        </label>

        {!user && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Senha *
            </span>
            <input
              type="password"
              className={inputClass}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              minLength={8}
              required
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Papel
          </span>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
          >
            {roleOptions
              .filter((option) => option.value !== 'OWNER' || canManageOwners)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>

        {stores.length > 1 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Loja
            </span>
            <select
              className={inputClass}
              value={form.storeId}
              onChange={(e) => update('storeId', e.target.value)}
              required
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Permissões
            </span>
            <button
              type="button"
              onClick={() =>
                update('permissions', rolePermissions(form.role))
              }
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Restaurar padrão do papel
            </button>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Ajuste fino sobre o papel — o que estiver marcado é o que o usuário
            pode fazer.
          </p>
          <div className="mt-3 space-y-3">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group}
                </p>
                <div className="mt-1 space-y-1">
                  {PERMISSIONS.filter(
                    (permission) => permission.group === group,
                  ).map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(permission.key)}
                        onChange={(e) =>
                          togglePermission(permission.key, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-600">
                        {permission.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {user && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update('active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">Usuário ativo</span>
          </label>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
