import { Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('As senhas não conferem');
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível redefinir',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Criar nova senha
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Defina uma nova senha para acessar sua conta.
        </p>

        {!token ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            Link inválido. Solicite uma nova recuperação de senha.
          </div>
        ) : done ? (
          <div className="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Senha alterada com sucesso! Redirecionando para o login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Nova senha
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirmar nova senha
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
