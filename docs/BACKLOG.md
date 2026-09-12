# Backlog — Sistema PDV SaaS

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído

## Fase 0 — Fundação

- [x] Criar monorepo (npm workspaces) com `apps/api` e `apps/web`
- [x] Docker Compose com PostgreSQL
- [x] Documentação de planejamento
- [x] Configurar Prisma 7 (config + driver adapter) + `DATABASE_URL`
- [x] Criar schema multi-tenant (Tenant, User, ...)
- [x] Gerar migration inicial (requer PostgreSQL rodando)
- [x] Módulo de autenticação (registro, login, refresh) com JWT
- [x] RBAC (OWNER, MANAGER, CASHIER) + guards globais
- [x] Permissões centralizadas no frontend (ocultar ações) + tela de matriz de permissões
- [x] Permissões por usuário (ajustes individuais grant/deny sobre o papel)
- [x] Lembrar a loja no login (prefill) + loja fixa no app desktop (VITE_TENANT_SLUG)
- [x] Regra de exclusão de usuário (bloqueia se tiver histórico; inativar)
- [x] Menu e rotas refletem as permissões do usuário (todas as áreas)
- [x] Resolução de tenant por request (claim no JWT + `@CurrentUser`)
- [x] ConfigModule global
- [x] Layout base do frontend (login + shell com sidebar + rotas protegidas)
- [x] Validação de variáveis de ambiente no boot
- [x] Rate limiting (login/registro/refresh) + Helmet
- [x] Revogação de refresh token (logout real via tokenVersion)
- [x] Auditoria (registro de ações sensíveis + página de consulta)
- [x] 2FA (TOTP) — ativar/desativar + login com código
- [x] RLS no Postgres (políticas por tenant + role de app não-superuser + transação por requisição)
- [x] Swagger/OpenAPI em `/docs`
- [x] CI (lint + build + testes) no GitHub Actions
- [x] Testes unitários (permissões, validação de env)

## Fase 1 — Núcleo de vendas

- [x] CRUD de Categorias
- [x] CRUD de Produtos (nome, sku, código de barras, preço, custo, unidade)
- [x] Produtos: importar/exportar CSV (catálogo em massa)
- [x] CRUD de Clientes
- [x] CRUD de Usuários da loja
- [x] Tela de PDV: busca por nome/código, carrinho, quantidade, desconto
- [x] Formas de pagamento (dinheiro, pix, crédito, débito) e troco
- [x] Múltiplos pagamentos na mesma venda
- [x] Leitura de código de barras (Enter) no PDV
- [x] Atalhos de teclado no PDV (F2/F3/F4/F6/F8/F9, Delete, setas, Ctrl+P, ?)
- [x] Multiplicador de quantidade (ex.: 3*) no PDV
- [x] Suspender/retomar venda (F7)
- [x] Atalhos de navegação global (Alt+1..8) e no caixa (Alt+S/Alt+U)
- [x] Modal de pagamento com teclas numéricas (1-4) e Enter para finalizar
- [x] Finalizar venda (transação: Sale + SaleItem + Payment)
- [x] Geração de número sequencial de venda por tenant

## Fase 2 — Operação de caixa

- [x] Abrir/fechar caixa
- [x] Sangria e suprimento
- [x] Resumo do turno (total por forma de pagamento)
- [x] Cancelamento de venda (com auditoria)
- [x] Impressão de cupom não-fiscal (ESC/POS-friendly 58/80mm)
- [x] Histórico e filtros de vendas

## Fase 3 — Negócio

- [x] Controle de estoque (baixa automática na venda, movimentações, estoque mínimo)
- [x] Dashboard com resumo real (vendas hoje/mês, ticket médio, gráfico de 7 dias)
- [x] Relatórios (vendas por período, produto, forma de pagamento) + exportação CSV
- [x] Planos e limites (FREE/BASIC/PRO) + uso e upgrade
- [x] Página pública de planos (pricing) com CTA de cadastro/assinatura
- [x] Página pública de download (app Windows .exe + instruções PWA/mobile)
- [x] Assinatura com pagamento (Asaas + provedor simulado, trial, status e webhook)
- [ ] Assinatura: configurar chave do Asaas em produção
- [x] Painel administrativo do SaaS (gestão de tenants, planos e status)
- [x] Cadastro self-service (tela pública cria loja + dono e já loga)
- [x] Tela de Configurações (dados da loja, preferências do PDV, minha conta/senha)
- [ ] Onboarding guiado da loja
- [ ] Confirmação de e-mail e recuperação de senha

## UX / Visual

- [x] Design system base (Button, Input, Card, Badge, EmptyState, Skeleton)
- [x] Toasts (sucesso/erro/info) + modal de confirmação estilizado
- [x] Responsividade (sidebar vira gaveta no mobile)
- [x] Cor da marca configurável por loja (aplica no sistema em tempo real)
- [ ] Tema claro/escuro
- [x] Polimento do Dashboard (cartões coloridos + formas de pagamento) e do PDV (total maior + destaque do item)
- [x] Modo tela cheia/kiosk no PDV (esconde menu/topo + fullscreen)

## Offline / Híbrido

- [x] Fase A — PWA (service worker + manifest) + cache de catálogo (produtos/clientes) em IndexedDB
- [x] Fase B — Vendas offline (registro local + fila de sincronização + idempotência por clientId)
- [x] Fase C — Caixa offline (fila + idempotência), preço preservado na venda, cache do caixa e reconciliação de catálogo
- [x] App instalável (PWA: ícones 192/512, manifest, botão "Instalar app")
- [x] App desktop instalável (Tauri) — instalador NSIS (.exe)
- [ ] Impressora térmica e gaveta de dinheiro no app desktop (Tauri)
- [ ] Deploy da API + URL configurável no app desktop

## Fase 4 — Escala

- [ ] Emissão fiscal NFC-e (integração terceirizada)
- [ ] Suporte multi-loja por tenant
- [ ] PWA offline robusto (fila de sincronização)
- [ ] Auditoria e logs estruturados
- [ ] Testes e2e dos fluxos críticos

## Site / Marketing

- [x] Landing page pública (raiz `/`) com hero, recursos, depoimentos e CTA
- [x] Central de Ajuda (`/ajuda`) — busca, todos os módulos, links para as telas e FAQ
- [x] Link "Ajuda" dentro do app (topo)
- [x] Sobre / Contato (`/sobre`)
- [x] SEO / Open Graph (meta tags)
- [x] Aceite dos Termos de Uso no cadastro (obrigatório + registro de data/versão)
- [x] App movido para `/painel` (landing pública na raiz)
- [ ] Status da plataforma (uptime)
- [ ] Blog / conteúdos

## Produção / Deploy

- [x] CORS restrito por origem (CORS_ORIGINS)
- [x] Páginas legais (Termos de Uso + Política de Privacidade/LGPD)
- [x] Página 404 + Error Boundary
- [x] Docker de produção (Dockerfiles + compose + nginx + Caddy/HTTPS)
- [x] Bootstrap do admin da plataforma (PLATFORM_ADMIN_EMAILS)
- [x] Backup automático do banco (serviço `backup` no compose + retenção)
- [ ] Observabilidade (logs estruturados / captura de erros)
- [x] Recuperação de senha (fluxo completo; SMTP opcional)
- [ ] Confirmação de e-mail
- [ ] Convites de equipe e recibo por e-mail

## Débitos técnicos / ideias

- [ ] Padronizar mensagens de erro da API (parcial: corrigidos 2 pontos que vazavam `throw new Error` cru como 500 genérico — ver `common/date-range.ts` e `subscription/payment-provider.ts`; a inconsistência `message: string` vs `string[]` do Nest/class-validator ficou como está, pois o frontend já trata ambos os formatos)
- [x] Paginação e ordenação padronizadas nas listagens
- [x] Seed de dados de demonstração
