import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { usersApi, type ManagedUser } from '../lib/users';
import { Modal } from './Modal';

interface PasswordModalProps {
  open: boolean;
  user: ManagedUser | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PasswordModal({
  open,
  user,
  onClose,
  onSaved,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.updatePassword(user.id, password);
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível redefinir',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={user ? `Redefinir senha de ${user.name}` : 'Redefinir senha'}
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
            form="password-form"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Redefinir'}
          </button>
        </>
      }
    >
      <form id="password-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Nova senha *
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
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
