import {
  BarChart3,
  Building2,
  Check,
  Clock,
  CreditCard,
  Database,
  FileCheck2,
  Gift,
  Headphones,
  KeyRound,
  Lock,
  Mail,
  Minus,
  Monitor,
  Package,
  Printer,
  Rocket,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Users,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { formatBRL } from '../lib/format';
import { PLANS, type PlanKey } from '../lib/tenant';

const ANNUAL_DISCOUNT = 0.2;

const highlights: Partial<Record<PlanKey, boolean>> = { BASIC: true };

interface ComparisonRow {
  label: string;
  values: Record<PlanKey, boolean | string>;
}

const comparison: ComparisonRow[] = [
  { label: 'PDV completo (venda, pagamento, troco)', values: { FREE: true, BASIC: true, PRO: true } },
  { label: 'Caixa (abrir/fechar, sangria)', values: { FREE: true, BASIC: true, PRO: true } },
  { label: 'Impressão de cupom (58/80mm)', values: { FREE: true, BASIC: true, PRO: true } },
  { label: 'Funciona offline e sincroniza', values: { FREE: true, BASIC: true, PRO: true } },
  { label: 'Usuários', values: { FREE: '2', BASIC: '5', PRO: '20' } },
  { label: 'Produtos', values: { FREE: '50', BASIC: '500', PRO: '5.000' } },
  { label: 'Relatórios avançados', values: { FREE: false, BASIC: false, PRO: true } },
  { label: 'Controle de estoque', values: { FREE: true, BASIC: true, PRO: true } },
  { label: 'Auditoria de ações', values: { FREE: false, BASIC: true, PRO: true } },
  { label: 'Suporte prioritário', values: { FREE: false, BASIC: false, PRO: true } },
];

const faq = [
  {
    q: 'Preciso de internet para usar o PDV?',
    a: 'Não. O sistema funciona offline: você vende e opera o caixa normalmente e, quando a internet volta, tudo é sincronizado automaticamente.',
  },
  {
    q: 'Posso trocar de plano depois?',
    a: 'Sim. Você pode fazer upgrade ou downgrade quando quiser, direto nas configurações da loja.',
  },
  {
    q: 'Como funciona o teste grátis?',
    a: 'Ao criar a conta você começa com 14 dias para testar sem compromisso. Não é preciso cartão para começar.',
  },
  {
    q: 'Quais formas de pagamento são aceitas?',
    a: 'Pix, boleto e cartão de crédito, com cobrança recorrente mensal ou anual.',
  },
  {
    q: 'Consigo usar em mais de um computador?',
    a: 'Sim. Você pode instalar o app em vários computadores e acessar com os usuários do seu plano.',
  },
];

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: ShoppingCart,
    title: 'PDV rápido',
    description:
      'Venda com leitor de código de barras, atalhos de teclado e pagamento dividido.',
  },
  {
    icon: Wifi,
    title: 'Funciona offline',
    description:
      'Continue vendendo sem internet. As vendas sincronizam automaticamente depois.',
  },
  {
    icon: Wallet,
    title: 'Caixa completo',
    description:
      'Abra e feche o caixa, registre sangria/suprimento e veja o resumo do turno.',
  },
  {
    icon: Package,
    title: 'Estoque sob controle',
    description:
      'Baixa automática na venda, movimentações e alerta de estoque mínimo.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    description:
      'Vendas por período, produto e forma de pagamento, com exportação em CSV.',
  },
  {
    icon: ShieldCheck,
    title: 'Permissões por usuário',
    description:
      'Papéis e acessos individuais: cada um vê e faz exatamente o que deve.',
  },
];

const steps = [
  {
    icon: Store,
    title: 'Crie a conta',
    description: 'Cadastre sua loja em poucos minutos, sem cartão de crédito.',
  },
  {
    icon: Package,
    title: 'Cadastre produtos',
    description: 'Adicione seu catálogo, preços e estoque inicial.',
  },
  {
    icon: ShoppingCart,
    title: 'Comece a vender',
    description: 'Use o PDV no computador ou tablet e acompanhe os resultados.',
  },
];

const testimonials = [
  {
    name: 'Ana Souza',
    business: 'Mercadinho Bom Preço',
    text: 'Antes eu anotava tudo no papel. Agora fecho o caixa em segundos e sei exatamente quanto vendi no dia.',
  },
  {
    name: 'Carlos Lima',
    business: 'Loja de Roupas Estilo',
    text: 'O que mais gostei é que funciona mesmo quando a internet cai. Não paro de vender por nada.',
  },
  {
    name: 'Juliana Alves',
    business: 'Papelaria Criativa',
    text: 'Os relatórios me ajudaram a entender o que mais vende e ajustar meu estoque. Recomendo demais.',
  },
];

const stats = [
  { value: '100%', label: 'Funciona offline' },
  { value: '14 dias', label: 'Grátis para testar' },
  { value: '0', label: 'Fidelidade ou multa' },
  { value: '5.000', label: 'Produtos no plano Pro' },
];

const segments = [
  'Mercados e mercearias',
  'Lojas de roupas',
  'Papelarias',
  'Restaurantes e lanchonetes',
  'Pet shops',
  'Farmácias',
  'Conveniências',
  'Barbearias e salões',
];

const securityItems: Feature[] = [
  {
    icon: Lock,
    title: 'Isolamento por loja',
    description:
      'Cada loja tem seus dados isolados no banco de dados (Row Level Security).',
  },
  {
    icon: KeyRound,
    title: 'Verificação em 2 etapas',
    description:
      'Proteja o acesso com código do app autenticador (Google Authenticator).',
  },
  {
    icon: FileCheck2,
    title: 'Auditoria',
    description:
      'Registro das ações sensíveis: quem fez, o que e quando.',
  },
  {
    icon: Users,
    title: 'Permissões por usuário',
    description:
      'Controle exatamente o que cada funcionário pode ver e fazer.',
  },
  {
    icon: Database,
    title: 'Dados protegidos',
    description: 'Senhas com criptografia e boas práticas de segurança.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidade (LGPD)',
    description: 'Tratamos os dados de clientes conforme a LGPD.',
  },
];

const integrations: Feature[] = [
  {
    icon: Monitor,
    title: 'App para Windows',
    description: 'Instale no computador da loja e use como um programa.',
  },
  {
    icon: Smartphone,
    title: 'Celular e tablet',
    description: 'Acesse pelo navegador ou instale como aplicativo (PWA).',
  },
  {
    icon: Printer,
    title: 'Impressora térmica',
    description: 'Cupom em 58mm ou 80mm, com os dados da sua loja.',
  },
  {
    icon: ScanLine,
    title: 'Leitor de código de barras',
    description: 'Bipe o produto e ele entra direto no carrinho.',
  },
  {
    icon: CreditCard,
    title: 'Pix e cartão',
    description: 'Receba com Pix, boleto e cartão via Asaas.',
  },
  {
    icon: Wifi,
    title: 'Modo offline',
    description: 'Venda sem internet e sincronize quando a conexão voltar.',
  },
];

const beforeAfter = {
  before: [
    'Anotações no caderno e planilhas soltas',
    'Estoque errado e vendas perdidas',
    'Sem controle de caixa e de troco',
    'Difícil saber o que mais vende',
  ],
  after: [
    'PDV rápido com leitor de código',
    'Estoque atualizado automaticamente',
    'Caixa e turno controlados',
    'Relatórios claros para decidir melhor',
  ],
};

const enterpriseBenefits = [
  'Lojas e usuários ilimitados',
  'Estoque compartilhado entre lojas',
  'Migração de dados assistida',
  'Treinamento da equipe',
  'Suporte prioritário e dedicado',
];

const roadmap = [
  {
    tag: 'Em breve',
    title: 'Emissão fiscal (NFC-e)',
    description: 'Emita nota fiscal direto do PDV, integrado.',
  },
  {
    tag: 'Em breve',
    title: 'Multi-loja',
    description: 'Gerencie matriz e filiais em um só lugar.',
  },
  {
    tag: 'Em breve',
    title: 'Fidelidade',
    description: 'Programa de pontos e cashback para clientes.',
  },
  {
    tag: 'Planejado',
    title: 'App mobile',
    description: 'Acompanhe vendas e estoque pelo celular.',
  },
];

const supportItems = [
  { icon: Mail, title: 'E-mail', description: 'suporte@sistemapdv.com' },
  { icon: Clock, title: 'Atendimento', description: 'Seg a sáb, das 8h às 20h' },
  {
    icon: Headphones,
    title: 'Suporte no Pro',
    description: 'Atendimento prioritário',
  },
];

function monthlyPrice(price: number, annual: boolean): number {
  if (price === 0) {
    return 0;
  }
  return annual ? price * (1 - ANNUAL_DISCOUNT) : price;
}

export function Pricing() {
  const { user } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
              to="/baixar"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
            >
              Baixar
            </Link>
            {user ? (
              <Link
                to="/painel"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  Entrar
                </Link>
                <Link
                  to="/registro"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            Teste grátis de 14 dias
          </span>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">
            Planos para o seu comércio
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            Comece grátis e evolua conforme a sua loja cresce. Todos os planos
            incluem PDV completo, caixa, cupom e funcionamento offline.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <span
            className={annual ? 'text-slate-400' : 'font-medium text-slate-900'}
          >
            Mensal
          </span>
          <button
            type="button"
            onClick={() => setAnnual((value) => !value)}
            className={`relative h-7 w-14 rounded-full transition ${
              annual ? 'bg-brand-600' : 'bg-slate-300'
            }`}
            aria-label="Alternar cobrança anual"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                annual ? 'left-8' : 'left-1'
              }`}
            />
          </button>
          <span
            className={annual ? 'font-medium text-slate-900' : 'text-slate-400'}
          >
            Anual
          </span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
            -20%
          </span>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const highlight = highlights[plan.key] === true;
            const price = monthlyPrice(plan.price, annual);
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                  highlight
                    ? 'border-brand-500 shadow-lg ring-1 ring-brand-500/20'
                    : 'border-slate-200'
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Mais popular
                  </span>
                )}
                <h2 className="text-lg font-semibold text-slate-900">
                  {plan.name}
                </h2>
                <p className="mt-3">
                  <span className="text-3xl font-bold text-slate-900">
                    {plan.price === 0 ? 'Grátis' : formatBRL(price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-slate-400">/mês</span>
                  )}
                </p>
                <p className="mt-1 h-4 text-xs text-slate-400">
                  {plan.price > 0 && annual
                    ? `Cobrado anualmente · ${formatBRL(price * 12)}/ano`
                    : plan.price > 0
                      ? 'Cobrado mensalmente'
                      : 'Para sempre'}
                </p>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {feature}
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {plan.maxUsers} usuário(s) · {plan.maxProducts} produtos
                  </li>
                </ul>

                <Link
                  to={user ? '/configuracoes' : '/registro'}
                  className={`mt-6 rounded-lg py-2.5 text-center text-sm font-semibold transition ${
                    highlight
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {plan.price === 0
                    ? 'Começar grátis'
                    : user
                      ? 'Assinar'
                      : 'Começar agora'}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> Sem fidelidade,
            cancele quando quiser
          </span>
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-brand-600" /> Funciona offline
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" /> Não precisa de
            cartão para testar
          </span>
        </div>

        <section className="mt-16 grid gap-4 rounded-2xl bg-slate-900 p-8 text-center text-white sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Tudo que sua loja precisa
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500">
            Do balcão ao estoque, o sistema cobre o dia a dia do seu comércio.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Comece em 3 passos
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <step.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-semibold text-brand-600">
                  Passo {index + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Comparativo de recursos
          </h2>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recurso</th>
                  {PLANS.map((plan) => (
                    <th key={plan.key} className="px-4 py-3 text-center">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-slate-700">{row.label}</td>
                    {PLANS.map((plan) => {
                      const value = row.values[plan.key];
                      return (
                        <td
                          key={plan.key}
                          className="px-4 py-3 text-center text-slate-600"
                        >
                          {value === true ? (
                            <Check className="mx-auto h-4 w-4 text-brand-600" />
                          ) : value === false ? (
                            <Minus className="mx-auto h-4 w-4 text-slate-300" />
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Quem usa, recomenda
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-2xl border border-slate-200 bg-white p-6"
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
        </section>

        <section className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Feito para o seu comércio
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-slate-500">
            Multi-nicho: use do seu jeito, seja balcão, loja ou lanchonete.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {segments.map((segment) => (
              <span
                key={segment}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
              >
                {segment}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Segurança de verdade
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500">
            Seus dados e os dos seus clientes protegidos.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {securityItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Integrações e dispositivos
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Por que trocar
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-500">
                Sem o sistema
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {beforeAfter.before.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
              <h3 className="text-sm font-semibold text-brand-700">
                Com o Sistema PDV
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {beforeAfter.after.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-8 p-8 sm:grid-cols-2 sm:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                <Building2 className="h-3.5 w-3.5" />
                Corporativo
              </span>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">
                Tem várias lojas ou um volume maior?
              </h2>
              <p className="mt-2 text-slate-500">
                Plano personalizado com multi-loja, estoque compartilhado,
                usuários ilimitados e suporte dedicado.
              </p>
              <a
                href="mailto:vendas@sistemapdv.com?subject=Quero%20um%20plano%20corporativo"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Falar com vendas
              </a>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 sm:pl-8">
              {enterpriseBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="flex items-center justify-center gap-2 text-center text-2xl font-bold text-slate-900">
            <Rocket className="h-6 w-6 text-brand-600" />
            O que vem por aí
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500">
            Estamos sempre evoluindo o sistema.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roadmap.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {item.tag}
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Perguntas frequentes
          </h2>
          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {faq.map((item, index) => {
              const open = openFaq === index;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-800"
                  >
                    {item.q}
                    <span className="text-slate-400">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-3">
          {supportItems.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center"
            >
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center text-sm text-brand-800">
          <Gift className="h-5 w-5" />
          <span>
            <strong>14 dias grátis</strong> — teste sem cartão e cancele quando
            quiser.
          </span>
        </section>

        <div className="mt-16 rounded-2xl bg-slate-900 p-10 text-center text-white">
          <h2 className="text-2xl font-bold">Pronto para começar a vender?</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-400">
            Crie a conta da sua loja em poucos minutos e comece a usar o PDV
            hoje mesmo — grátis por 14 dias.
          </p>
          <Link
            to={user ? '/painel' : '/registro'}
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-brand-400"
          >
            {user ? 'Ir para o painel' : 'Criar minha loja'}
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-slate-400 sm:flex-row">
          <span>
            © {new Date().getFullYear()} Sistema PDV. Todos os direitos
            reservados.
          </span>
          <div className="flex gap-4">
            <Link to="/baixar" className="hover:text-slate-600">
              Baixar
            </Link>
            <Link to="/termos" className="hover:text-slate-600">
              Termos
            </Link>
            <Link to="/privacidade" className="hover:text-slate-600">
              Privacidade
            </Link>
            <Link to="/login" className="hover:text-slate-600">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
