import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-slate-900">
              P
            </div>
            <span className="text-lg font-semibold text-slate-900">
              Sistema PDV
            </span>
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Última atualização: {updatedAt}
        </p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-4 px-6 text-xs text-slate-400">
          <Link to="/termos" className="hover:text-slate-600">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="hover:text-slate-600">
            Política de Privacidade
          </Link>
          <Link to="/planos" className="hover:text-slate-600">
            Planos
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
