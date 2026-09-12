import { Lock, Mail, Store, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/useAuth';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/painel" replace />;
  }

  function handleTenantName(value: string) {
    setTenantName(value);
    if (!slugTouched) {
      setTenantSlug(slugify(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('As senhas não conferem');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        tenantName: tenantName.trim(),
        tenantSlug: tenantSlug.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        acceptedTerms,
      });
      navigate('/painel', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível criar a conta',
      );
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
            Comece a vender
            <br />
            em poucos minutos.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Crie a conta da sua loja e já comece a usar o PDV, o caixa e os
            relatórios.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Sistema PDV.
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-md">
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

          <h2 className="text-2xl font-semibold text-slate-900">
            Criar conta da loja
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Você será o proprietário e poderá convidar sua equipe depois.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Nome da loja
              </span>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputClass}
                  value={tenantName}
                  onChange={(e) => handleTenantName(e.target.value)}
                  placeholder="Minha Loja"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Identificador da loja
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                value={tenantSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setTenantSlug(slugify(e.target.value));
                }}
                placeholder="minha-loja"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
              />
              <span className="mt-1 block text-xs text-slate-400">
                Usado no login. Apenas letras minúsculas, números e hífens.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Seu nome
              </span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
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

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Senha
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirmar
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className={inputClass}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </label>
            </div>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-600">
                Li e aceito os{' '}
                <Link
                  to="/termos"
                  target="_blank"
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link
                  to="/privacidade"
                  target="_blank"
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>

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
              {submitting ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Já tem conta?{' '}
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Entrar
            </Link>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link
              to="/planos"
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Ver planos e preços
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
