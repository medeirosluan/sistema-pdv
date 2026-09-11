import {
  BarChart3,
  Check,
  Package,
  ShieldCheck,
  ShoppingCart,
  Star,
  Wallet,
  Wifi,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';
import { useAuth } from '../lib/auth';
import { formatBRL } from '../lib/format';

const features = [
  {
    icon: ShoppingCart,
    title: 'PDV rápido e fácil',
    description: 'Busca por código de barras, atalhos e pagamento dividido.',
  },
  {
    icon: Wifi,
    title: 'Funciona offline',
    description: 'Venda sem internet e sincronize automaticamente depois.',
  },
  {
    icon: Wallet,
    title: 'Caixa completo',
    description: 'Abertura, fechamento, sangria e resumo do turno.',
  },
  {
    icon: Package,
    title: 'Estoque controlado',
    description: 'Baixa automática e alerta de estoque mínimo.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    description: 'Vendas por período, produto e forma de pagamento.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguro',
    description: 'Permissões por usuário, auditoria e verificação em 2 etapas.',
  },
];

const testimonials = [
  {
    name: 'Ana Souza',
    business: 'Mercadinho Bom Preço',
    text: 'Fecho o caixa em segundos e sei exatamente quanto vendi no dia.',
  },
  {
    name: 'Carlos Lima',
    business: 'Loja de Roupas Estilo',
    text: 'Funciona mesmo quando a internet cai. Não paro de vender por nada.',
  },
  {
    name: 'Juliana Alves',
    business: 'Papelaria Criativa',
    text: 'Os relatórios me ajudaram a ajustar o estoque. Recomendo demais.',
  },
];

export function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              Teste grátis de 14 dias
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 lg:text-5xl">
              O PDV completo para o seu comércio
            </h1>
            <p className="mt-4 max-w-lg text-lg text-slate-500">
              Venda, controle o caixa e o estoque, e acompanhe os resultados —
              tudo em um só lugar. Funciona no computador, tablet e celular, com
              ou sem internet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? '/painel' : '/registro'}
                className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                {user ? 'Ir para o painel' : 'Começar grátis'}
              </Link>
              <Link
                to="/planos"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver planos
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-600" /> Sem cartão
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-600" /> Sem fidelidade
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-600" /> Suporte em
                português
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-slate-400">PDV</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                ['Coca-Cola 350ml', '2 x R$ 5,50', 'R$ 11,00'],
                ['Pão francês', '0,5 kg x R$ 14,90', 'R$ 7,45'],
                ['Água 500ml', '1 x R$ 3,00', 'R$ 3,00'],
              ].map(([name, qty, total]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{name}</p>
                    <p className="text-xs text-slate-400">{qty}</p>
                  </div>
                  <span className="font-semibold text-slate-800">{total}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-2xl font-bold text-slate-900">
                {formatBRL(21.45)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {['Dinheiro', 'Pix', 'Crédito', 'Débito'].map((method) => (
                <span
                  key={method}
                  className="rounded-lg border border-slate-200 py-2 text-center text-xs font-medium text-slate-600"
                >
                  {method}
                </span>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-brand-600 py-2.5 text-center text-sm font-semibold text-white">
              Finalizar venda (F9)
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Tudo que sua loja precisa
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Comece em 3 passos
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ['Crie a conta', 'Cadastre sua loja em poucos minutos.'],
              ['Cadastre produtos', 'Adicione seu catálogo e estoque.'],
              ['Comece a vender', 'Use o PDV e acompanhe os resultados.'],
            ].map(([title, description], index) => (
              <div key={title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Quem usa, recomenda
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="rounded-2xl border border-slate-200 p-6"
                >
                  <div className="flex gap-0.5 text-brand-500">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    “{testimonial.text}”
                  </p>
                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {testimonial.business}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl bg-slate-900 p-10 text-center text-white">
            <h2 className="text-2xl font-bold">
              Pronto para começar a vender?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-400">
              Crie a conta da sua loja grátis por 14 dias e comece hoje mesmo.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to={user ? '/painel' : '/registro'}
                className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-brand-400"
              >
                {user ? 'Ir para o painel' : 'Criar minha loja'}
              </Link>
              <Link
                to="/planos"
                className="rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
