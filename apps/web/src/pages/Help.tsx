import { ExternalLink, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter } from '../components/PublicFooter';
import { PublicHeader } from '../components/PublicHeader';

interface Article {
  title: string;
  content: string;
  to?: string;
}

interface Category {
  title: string;
  articles: Article[];
}

const categories: Category[] = [
  {
    title: 'Instalação e primeiros passos',
    articles: [
      {
        title: 'Instalar no Windows',
        content:
          'Baixe o instalador em "Baixar", execute o arquivo .exe e siga o assistente. Depois abra o "Sistema PDV" pelo menu Iniciar.',
        to: '/baixar',
      },
      {
        title: 'Instalar no celular ou tablet',
        content:
          'Acesse o sistema pelo navegador (Chrome/Edge/Safari). No Android use "Instalar app"; no iPhone, Compartilhar → "Adicionar à Tela de Início".',
        to: '/baixar',
      },
      {
        title: 'Criar a conta da loja',
        content:
          'Em "Criar conta", informe o nome da loja, um identificador (slug), seu nome, e-mail e senha. Você entra como proprietário.',
        to: '/registro',
      },
      {
        title: 'Configurar os dados da loja',
        content:
          'Em Configurações → Dados da loja, preencha nome, CNPJ/CPF, telefone, e-mail e endereço. Esses dados aparecem no cupom.',
        to: '/configuracoes',
      },
      {
        title: 'Cadastrar os primeiros produtos',
        content:
          'Em Produtos → Novo produto, informe nome, preço e, se quiser, código de barras, categoria, custo e estoque.',
        to: '/produtos',
      },
      {
        title: 'Abrir o caixa',
        content:
          'Em Caixa, informe o valor de abertura do turno para começar a operar.',
        to: '/caixa',
      },
    ],
  },
  {
    title: 'PDV e vendas',
    articles: [
      {
        title: 'Fazer uma venda',
        content:
          'No PDV, busque o produto (ou bipe o código) e pressione Enter. Ajuste a quantidade, aplique desconto e clique em Pagamento (F8) para escolher a forma e finalizar (F9).',
        to: '/pdv',
      },
      {
        title: 'Formas de pagamento e troco',
        content:
          'Aceita Dinheiro, Pix, Crédito e Débito. No dinheiro, informe o valor recebido e o sistema calcula o troco.',
        to: '/pdv',
      },
      {
        title: 'Dividir o pagamento',
        content:
          'No pagamento, use "Adicionar forma de pagamento" para dividir entre várias formas (ex.: parte no Pix, parte em dinheiro).',
        to: '/pdv',
      },
      {
        title: 'Aplicar desconto',
        content:
          'No carrinho, informe o valor no campo "Desconto". O proprietário pode definir um desconto máximo em Configurações.',
        to: '/pdv',
      },
      {
        title: 'Atalhos do PDV',
        content:
          'F2 busca, Enter adiciona, F3 consulta preço, F4 desconto, F6 cancela, F8 pagamento, F9 finaliza, F10 tela cheia, Delete remove item, Ctrl+P reimprime o cupom.',
        to: '/pdv',
      },
      {
        title: 'Modo tela cheia (kiosk)',
        content:
          'No PDV, use o botão de tela cheia ou a tecla F10. O menu e o topo somem e o PDV ocupa a tela toda. Saia com o botão flutuante ou Esc.',
        to: '/pdv',
      },
      {
        title: 'Vender sem internet',
        content:
          'O PDV funciona offline. As vendas ficam pendentes (indicador no topo) e sincronizam automaticamente quando a conexão volta.',
        to: '/pdv',
      },
      {
        title: 'Cancelar uma venda',
        content:
          'Em Vendas, localize a venda, abra os detalhes e clique em "Cancelar venda". O estoque é devolvido automaticamente.',
        to: '/vendas',
      },
    ],
  },
  {
    title: 'Impressão',
    articles: [
      {
        title: 'Imprimir ou reimprimir o cupom',
        content:
          'Ao finalizar, clique em "Cupom". Para reimprimir, em Vendas → detalhes → "Imprimir cupom" (ou Ctrl+P no PDV).',
        to: '/vendas',
      },
      {
        title: 'Largura do cupom (58/80mm)',
        content:
          'Em Configurações → Preferências do PDV, escolha a largura da impressora e o rodapé do cupom.',
        to: '/configuracoes',
      },
      {
        title: 'Impressão automática',
        content:
          'Em Configurações → Preferências, ative "Imprimir cupom automaticamente ao finalizar a venda".',
        to: '/configuracoes',
      },
    ],
  },
  {
    title: 'Produtos e estoque',
    articles: [
      {
        title: 'Cadastrar e editar produtos',
        content:
          'Em Produtos, use "Novo produto" ou o lápis para editar. Dá para ativar/inativar e excluir.',
        to: '/produtos',
      },
      {
        title: 'Organizar por categorias',
        content:
          'Em Produtos → Categorias, crie, renomeie e exclua categorias para organizar o catálogo.',
        to: '/produtos',
      },
      {
        title: 'Estoque mínimo e alerta',
        content:
          'Defina o "estoque mínimo" no produto. Quando o estoque fica igual ou abaixo do mínimo, ele é destacado e aparece no alerta do painel.',
        to: '/produtos',
      },
      {
        title: 'Movimentar o estoque',
        content:
          'Em Produtos, clique no ícone de estoque do produto para dar entrada, saída ou fazer um ajuste de inventário, com motivo e histórico.',
        to: '/produtos',
      },
    ],
  },
  {
    title: 'Clientes',
    articles: [
      {
        title: 'Cadastrar clientes',
        content:
          'Em Clientes, clique em "Novo cliente" e informe nome, documento, telefone e e-mail.',
        to: '/clientes',
      },
      {
        title: 'Vincular cliente à venda',
        content:
          'No PDV, use o campo "Cliente (opcional)" para buscar e selecionar o cliente antes de finalizar.',
        to: '/pdv',
      },
    ],
  },
  {
    title: 'Caixa',
    articles: [
      {
        title: 'Abrir e fechar o caixa',
        content:
          'Em Caixa, informe o valor de abertura. No fim do turno, feche informando o valor contado para ver a diferença.',
        to: '/caixa',
      },
      {
        title: 'Sangria e suprimento',
        content:
          'Sangria é a retirada de dinheiro da gaveta; suprimento é a entrada (troco). Atalhos: Alt+S (sangria) e Alt+U (suprimento).',
        to: '/caixa',
      },
      {
        title: 'Resumo do turno',
        content:
          'A tela do caixa mostra o total por forma de pagamento, sangrias, suprimentos e o dinheiro esperado na gaveta.',
        to: '/caixa',
      },
    ],
  },
  {
    title: 'Relatórios e painel',
    articles: [
      {
        title: 'Ver o resumo da loja',
        content:
          'A "Visão geral" mostra vendas de hoje e do mês, ticket médio, formas de pagamento e últimas vendas.',
        to: '/painel',
      },
      {
        title: 'Relatórios por período',
        content:
          'Em Relatórios, escolha o período para ver faturamento, vendas, ticket médio, descontos e o detalhamento por produto e forma de pagamento.',
        to: '/relatorios',
      },
      {
        title: 'Exportar em CSV',
        content:
          'Nos relatórios, use os botões "CSV" para baixar os dados de produtos e formas de pagamento.',
        to: '/relatorios',
      },
    ],
  },
  {
    title: 'Usuários e permissões',
    articles: [
      {
        title: 'Adicionar funcionários',
        content:
          'Em Usuários → Novo usuário, informe nome, e-mail, senha e escolha o papel (Gerente ou Operador).',
        to: '/usuarios',
      },
      {
        title: 'Papéis e permissões',
        content:
          'Cada papel tem permissões padrão. Você pode marcar/desmarcar permissões individuais (ex.: permitir cancelar venda só para alguns).',
        to: '/usuarios',
      },
      {
        title: 'Ativar, inativar e excluir',
        content:
          'Use o botão de energia para ativar/inativar. Usuários com histórico (vendas/caixa) não podem ser excluídos — apenas inativados.',
        to: '/usuarios',
      },
    ],
  },
  {
    title: 'Segurança e conta',
    articles: [
      {
        title: 'Ativar verificação em duas etapas (2FA)',
        content:
          'Em Configurações → Verificação em duas etapas, clique em "Ativar 2FA", escaneie o QR no app autenticador e confirme o código.',
        to: '/configuracoes',
      },
      {
        title: 'Alterar minha senha',
        content:
          'Clique no ícone de chave no topo do app e informe a senha atual e a nova.',
        to: '/painel',
      },
      {
        title: 'Recuperar senha esquecida',
        content:
          'Na tela de login, clique em "Esqueci minha senha" e informe a loja e o e-mail para receber o link de redefinição.',
        to: '/esqueci-senha',
      },
      {
        title: 'Auditoria',
        content:
          'Em Auditoria, veja o registro das ações sensíveis: logins, alterações de usuário, cancelamento de venda, troca de plano e mais.',
        to: '/auditoria',
      },
    ],
  },
  {
    title: 'Assinatura e pagamento',
    articles: [
      {
        title: 'Planos e teste grátis',
        content:
          'Você começa com 14 dias de teste, sem cartão. Veja os planos e limites na página de planos.',
        to: '/planos',
      },
      {
        title: 'Assinar ou trocar de plano',
        content:
          'Em Configurações → Plano e uso, clique em "Assinar" no plano desejado. Aceitamos Pix, boleto e cartão.',
        to: '/configuracoes',
      },
      {
        title: 'Cancelar assinatura',
        content:
          'Em Configurações → Plano e uso, use "Cancelar assinatura". O acesso aos recursos pagos segue até o fim do período.',
        to: '/configuracoes',
      },
    ],
  },
];

const faq = [
  {
    q: 'Preciso de internet para usar o PDV?',
    a: 'Não. O sistema funciona offline e sincroniza quando a conexão volta.',
  },
  {
    q: 'Posso usar em mais de um computador?',
    a: 'Sim. Instale o app em vários computadores e acesse com os usuários do seu plano.',
  },
  {
    q: 'Como funciona o teste grátis?',
    a: 'Você tem 14 dias para testar sem compromisso e sem cartão de crédito.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Sim. Cada loja tem dados isolados, senhas criptografadas, permissões, auditoria e opção de 2FA.',
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function Help() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(
    `${categories[0].title}-0`,
  );

  const results = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) {
      return null;
    }
    const found: { category: string; article: Article; index: number }[] = [];
    for (const category of categories) {
      category.articles.forEach((article, index) => {
        if (
          normalize(article.title).includes(term) ||
          normalize(article.content).includes(term)
        ) {
          found.push({ category: category.title, article, index });
        }
      });
    }
    return found;
  }, [query]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900">
            Central de Ajuda
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Tudo para configurar e usar o Sistema PDV no dia a dia.
          </p>
        </div>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na ajuda (ex.: cupom, offline, estoque)"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {results ? (
          <div className="mt-8 space-y-3">
            {results.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Nada encontrado para “{query}”. Tente outra palavra ou fale com
                o suporte.
              </p>
            )}
            {results.map(({ category, article }) => (
              <div
                key={`${category}-${article.title}`}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {category}
                </p>
                <h3 className="mt-1 font-semibold text-slate-900">
                  {article.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {article.content}
                </p>
                {article.to && (
                  <Link
                    to={article.to}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Abrir tela
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {categories.map((category) => (
              <section key={category.title}>
                <h2 className="text-lg font-semibold text-slate-900">
                  {category.title}
                </h2>
                <div className="mt-4 space-y-3">
                  {category.articles.map((article, index) => {
                    const key = `${category.title}-${index}`;
                    const isOpen = open === key;
                    return (
                      <div
                        key={key}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : key)}
                          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-800"
                        >
                          {article.title}
                          <span className="text-slate-400">
                            {isOpen ? '−' : '+'}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 px-5 py-4">
                            <p className="text-sm text-slate-500">
                              {article.content}
                            </p>
                            {article.to && (
                              <Link
                                to={article.to}
                                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                              >
                                Abrir tela
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Perguntas frequentes
          </h2>
          <div className="mt-6 space-y-3">
            {faq.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  {item.q}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-16 rounded-2xl bg-slate-900 p-8 text-center text-white">
          <h2 className="text-xl font-bold">Ainda com dúvidas?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Fale com o nosso suporte — respondemos rapidinho.
          </p>
          <a
            href="mailto:suporte@sistemapdv.com?subject=D%C3%BAvida%20sobre%20o%20Sistema%20PDV"
            className="mt-5 inline-block rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-brand-400"
          >
            Falar com o suporte
          </a>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
