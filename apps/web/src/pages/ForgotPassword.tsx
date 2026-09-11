import { ArrowLeft, Mail, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../lib/api';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function ForgotPassword() {
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.forgotPassword(tenantSlug.trim().toLowerCase(), email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível enviar',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          Recuperar senha
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Informe a loja e o e-mail para receber o link de redefinição.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Se os dados estiverem corretos, enviamos um e-mail com o link para
            criar uma nova senha. Verifique também a caixa de spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Loja
              </span>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputClass}
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="minha-loja"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@loja.com"
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
              {submitting ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
