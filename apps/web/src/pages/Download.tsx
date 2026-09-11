import {
  Check,
  Download as DownloadIcon,
  Globe,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const APP_VERSION = '0.1.0';
const INSTALLER_URL = '/downloads/Sistema-PDV-Setup.exe';

const windowsSteps = [
  'Clique em "Baixar para Windows" e aguarde o download do arquivo .exe.',
  'Abra o arquivo "Sistema-PDV-Setup.exe" que foi baixado.',
  'Se o Windows SmartScreen aparecer, clique em "Mais informações" e "Executar assim mesmo".',
  'Siga o instalador e abra o "Sistema PDV" pelo menu Iniciar.',
];

const pwaSteps = [
  'Acesse o sistema pelo navegador (Chrome ou Edge).',
  'Clique no ícone de instalar na barra de endereço ou no botão "Instalar app".',
  'Confirme a instalação — o app abre em uma janela própria.',
];

const mobileSteps = [
  'Android: abra no Chrome e toque em "Instalar app" ou "Adicionar à tela inicial".',
  'iPhone/iPad: abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".',
];

export function Download() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-slate-900">
              P
            </div>
            <span className="text-lg font-semibold text-slate-900">
              Sistema PDV
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/planos"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Planos
            </Link>
            <Link
              to={user ? '/painel' : '/login'}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {user ? 'Painel' : 'Entrar'}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900">
            Baixe o Sistema PDV
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            Use no computador da loja como um programa, ou instale no celular e
            tablet direto pelo navegador.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-brand-500 bg-white p-6 shadow-lg ring-1 ring-brand-500/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Monitor className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Windows
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Programa completo para o balcão. Funciona offline.
            </p>
            <a
              href={INSTALLER_URL}
              download
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <DownloadIcon className="h-4 w-4" />
              Baixar para Windows (.exe)
            </a>
            <p className="mt-2 text-center text-xs text-slate-400">
              Versão {APP_VERSION} · ~2 MB · Windows 10/11 (64 bits)
            </p>
            <ol className="mt-5 space-y-2 text-sm text-slate-600">
              {windowsSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Globe className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Navegador (PWA)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Instale como app sem baixar arquivo — no PC, tablet ou celular.
            </p>
            <Link
              to={user ? '/painel' : '/login'}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir o sistema
            </Link>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {pwaSteps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Smartphone className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Celular e tablet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Consulte vendas, estoque e acompanhe a loja de onde estiver.
            </p>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {mobileSteps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="mt-16 rounded-2xl bg-slate-900 p-10 text-center text-white">
          <h2 className="text-2xl font-bold">Precisa de ajuda para instalar?</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-400">
            Fale com o nosso suporte que ajudamos você a colocar o sistema para
            rodar na sua loja.
          </p>
          <a
            href="mailto:suporte@sistemapdv.com?subject=Ajuda%20para%20instalar%20o%20Sistema%20PDV"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-brand-400"
          >
            Falar com o suporte
          </a>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 px-6 text-xs text-slate-400">
          <Link to="/planos" className="hover:text-slate-600">
            Planos
          </Link>
          <Link to="/termos" className="hover:text-slate-600">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="hover:text-slate-600">
            Política de Privacidade
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Sistema PDV. Todos os direitos
          reservados.
        </p>
      </footer>
    </div>
  );
}
