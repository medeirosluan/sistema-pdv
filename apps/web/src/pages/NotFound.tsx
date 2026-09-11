import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
