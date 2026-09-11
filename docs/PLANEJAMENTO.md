# Planejamento — Sistema PDV SaaS

SaaS de Ponto de Venda (PDV) **multi-nicho**, **multi-tenant** e **web**, com foco inicial em **vendas**.

## 1. Visão do produto

Um sistema onde qualquer comércio (varejo, mercadinho, restaurante, papelaria) cria uma conta,
cadastra seus produtos e começa a vender em minutos. Cada cliente (loja) é um **tenant** isolado
dos demais. A monetização é por **assinatura mensal** (planos).

## 2. Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | React + TypeScript + Vite | SPA, ideal para operação com teclado/leitor |
| UI | Tailwind CSS + shadcn/ui | Componentes rápidos e consistentes |
| Estado/Dados | TanStack Query + Zustand | Cache do servidor + estado local |
| Offline | PWA + IndexedDB (Dexie) | Vender mesmo sem internet |
| Backend | NestJS (Node + TS) | Modular, testável, ideal para SaaS |
| ORM | Prisma | Migrations e tipagem forte |
| Banco | PostgreSQL | `tenant_id` em todas as tabelas + Row Level Security |
| Auth | JWT (access + refresh) + RBAC | Papéis: OWNER, MANAGER, CASHIER |
| Impressão | ESC/POS (WebSerial/WebUSB) ou QZ Tray | Cupom em impressora térmica |
| Fiscal | API terceirizada (Nuvem Fiscal / Focus NFe) | Nunca implementar NFC-e do zero |
| Pagamentos | Mercado Pago / Pagar.me | Pix, cartão e cobrança da assinatura |
| Deploy | Docker + VPS (ou Railway/Render) | Front estático + API em container |

## 3. Arquitetura multi-tenant

Estratégia: **banco único compartilhado com `tenant_id`** + **Row Level Security (RLS)** no PostgreSQL.

- Toda tabela de negócio possui `tenant_id`.
- O backend resolve o tenant a partir do usuário autenticado (claim no JWT).
- Um `TenantContext` (AsyncLocalStorage / request-scoped) injeta o `tenant_id` nas queries.
- RLS no banco garante isolamento mesmo em caso de bug na aplicação.

Alternativa futura (quando houver clientes grandes): schema por tenant ou banco dedicado.

## 4. Modelo de dados inicial

```
Tenant         (empresa/loja)     1─N  User
Tenant         1─N  Category
Tenant         1─N  Product        1─N  Category (opcional)
Tenant         1─N  Customer
Tenant         1─N  CashRegister   1─N  CashMovement
Tenant         1─N  Sale           1─N  SaleItem
Sale           1─N  Payment
```

Campos essenciais (v1):

- **Tenant**: id, nome, slug, plano, status, criadoEm
- **User**: id, tenantId, nome, email (único), senhaHash, papel, ativo
- **Category**: id, tenantId, nome
- **Product**: id, tenantId, nome, sku, codigoBarras, preco, custo, unidade, ativo, estoqueAtual
- **Customer**: id, tenantId, nome, documento, telefone, email
- **Sale**: id, tenantId, numero, status (ABERTA/FINALIZADA/CANCELADA), subtotal, desconto, total, criadoPor, criadoEm
- **SaleItem**: id, saleId, productId, descricao, quantidade, precoUnitario, total
- **Payment**: id, saleId, metodo (DINHEIRO/PIX/CREDITO/DEBITO), valor, parcelas
- **CashRegister**: id, tenantId, abertoPor, valorAbertura, valorFechamento, abertoEm, fechadoEm, status
- **CashMovement**: id, cashRegisterId, tipo (SANGRIA/SUPRIMENTO), valor, motivo, criadoEm

## 5. Escopo do MVP

Entra no MVP:

1. Cadastro de empresa + login (auth + tenant).
2. Cadastros base: produtos, categorias, clientes, usuários.
3. PDV: busca de produto → carrinho → formas de pagamento → finalizar venda.
4. Caixa: abrir/fechar, sangria/suprimento, resumo do turno.
5. Histórico: listar e cancelar vendas.
6. Impressão de cupom **não-fiscal**.

Fica FORA do MVP (fases futuras): fiscal (NFC-e), estoque avançado, delivery, app mobile,
relatórios analíticos, integração com marketplaces.

## 6. Roadmap por fases

| Fase | Duração estimada | Entregas |
|---|---|---|
| 0 — Fundação | 1 semana | Monorepo, Docker, Postgres, auth + tenant, CI básico |
| 1 — Núcleo | 2–3 semanas | CRUD produtos/categorias/clientes + PDV + venda |
| 2 — Operação | 1–2 semanas | Caixa, cancelamento, impressão, histórico |
| 3 — Negócio | 2 semanas | Estoque, relatórios, planos/assinatura |
| 4 — Escala | contínuo | Fiscal (NFC-e), multi-loja, offline robusto, auditoria |

## 7. Convenções

- Idioma do domínio (nomes de negócio) em **português**; código/infra em inglês quando fizer sentido.
- Uma feature por módulo no backend (`products`, `sales`, `cash`, ...).
- Toda rota é protegida por padrão; liberar explicitamente as públicas (`/auth/login`, `/auth/register`).
- Validação de entrada com `class-validator` + DTOs.
- Nunca confiar em `tenantId` vindo do cliente — sempre derivar do token.

## 8. Segurança e LGPD

- Senhas com bcrypt/argon2.
- Rate limiting no login.
- Logs de auditoria para ações sensíveis (cancelamento de venda, sangria).
- Dados de clientes tratados conforme LGPD; possibilidade de exportar/excluir.
