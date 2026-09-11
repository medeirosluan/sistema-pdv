import { Clock, Mail, MapPin, MessageCircle } from 'lucide-react';
import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';

const contacts = [
  {
    icon: Mail,
    title: 'E-mail',
    value: 'contato@sistemapdv.com',
    href: 'mailto:contato@sistemapdv.com',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    value: '(11) 90000-0000',
    href: 'https://wa.me/5511900000000',
  },
  {
    icon: Clock,
    title: 'Atendimento',
    value: 'Seg a sáb, das 8h às 20h',
    href: null,
  },
  {
    icon: MapPin,
    title: 'Localização',
    value: 'São Paulo/SP — Brasil',
    href: null,
  },
];

export function About() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900">
            Sobre o Sistema PDV
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            Ajudamos pequenos e médios comércios a vender mais e organizar o dia
            a dia, com uma ferramenta simples, rápida e que funciona mesmo sem
            internet.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: 'Simples de usar',
              text: 'Feito para o balcão: sem complicação, com atalhos e fluxo rápido de venda.',
            },
            {
              title: 'Confiável',
              text: 'Funciona offline e protege seus dados com isolamento, auditoria e 2FA.',
            },
            {
              title: 'Acessível',
              text: 'Planos a partir do grátis, sem fidelidade e sem taxas escondidas.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{item.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Fale com a gente
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {contacts.map((contact) => {
              const content = (
                <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <contact.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {contact.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {contact.value}
                    </p>
                  </div>
                </div>
              );
              return contact.href ? (
                <a
                  key={contact.title}
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {content}
                </a>
              ) : (
                <div key={contact.title}>{content}</div>
              );
            })}
          </div>
        </section>

        <div className="mt-16 rounded-2xl bg-slate-900 p-10 text-center text-white">
          <h2 className="text-2xl font-bold">Quer começar agora?</h2>
          <p className="mx-auto mt-2 max-w-lg text-slate-400">
            Crie sua conta grátis e teste por 14 dias, sem cartão.
          </p>
          <a
            href="/registro"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-brand-400"
          >
            Criar minha loja
          </a>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
