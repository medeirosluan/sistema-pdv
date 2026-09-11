import { Lock, Mail, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

const STORAGE_KEY = 'pdv.lastTenantSlug';

function initialSlug(): string {
  const fromEnv = import.meta.env.VITE_TENANT_SLUG as string | undefined;
  return localStorage.getItem(STORAGE_KEY) ?? fromEnv ?? '';
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [tenantSlug, setTenantSlug] = useState(initialSlug);
  const [showStoreField, setShowStoreField] = useState(
    () => initialSlug() === '',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/painel" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const slug = tenantSlug.trim().toLowerCase();
      await login(slug, email.trim(), password, totp.trim() || undefined);
      localStorage.setItem(STORAGE_KEY, slug);
      navigate('/painel', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar. Tente novamente.';
      if (message.toLowerCase().includes('2fa')) {
        setNeedTotp(true);
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-slate-900">
            P
          </div>
          <span className="text-xl font-semibold">Sistema PDV</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Venda mais,
            <br />
            complique menos.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Ponto de venda completo para o seu comércio: vendas, caixa,
            produtos e clientes em um só lugar.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Sistema PDV. Todos os direitos
          reservados.
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-slate-900">
                P
              </div>
              <span className="text-lg font-semibold text-slate-900">
                Sistema PDV
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Acesse o painel da sua loja.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {showStoreField ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Loja
                </span>
                <div className="relative">
                  <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="minha-loja"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <Store className="h-4 w-4 text-slate-400" />
                  Loja:{' '}
                  <strong className="font-medium text-slate-800">
                    {tenantSlug}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowStoreField(true)}
                  className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
                >
                  Trocar
                </button>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@loja.com"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
                Senha
                <Link
                  to="/esqueci-senha"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Esqueci minha senha
                </Link>
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </label>

            {needTotp && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Código de verificação (2FA)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Ainda não tem conta?{' '}
            <Link
              to="/registro"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Cadastre sua loja
            </Link>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link
              to="/planos"
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Ver planos e preços
            </Link>
            <span className="mx-2 text-slate-300">·</span>
            <Link
              to="/baixar"
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Baixar o app
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
