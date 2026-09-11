import { Link } from 'react-router-dom';

const columns = [
  {
    title: 'Produto',
    links: [
      { to: '/planos', label: 'Planos e preços' },
      { to: '/baixar', label: 'Baixar o app' },
      { to: '/ajuda', label: 'Central de ajuda' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { to: '/sobre', label: 'Sobre' },
      { to: '/sobre', label: 'Contato' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/termos', label: 'Termos de Uso' },
      { to: '/privacidade', label: 'Política de Privacidade' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-slate-900">
                P
              </div>
              <span className="font-semibold text-slate-900">Sistema PDV</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Ponto de venda completo para o seu comércio, com vendas, caixa,
              estoque e relatórios.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-slate-900">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="hover:text-slate-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Sistema PDV. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
