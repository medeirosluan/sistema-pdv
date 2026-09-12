# Sistema PDV — SaaS

SaaS de Ponto de Venda (PDV) **multi-nicho**, **multi-tenant** e **web**.

- Documentação de produto e arquitetura: [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md)
- Backlog por fases: [`docs/BACKLOG.md`](docs/BACKLOG.md)

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL (`apps/api`)
- **Frontend**: React + TypeScript + Vite (`apps/web`)
- **Banco**: PostgreSQL 16 via Docker Compose

## Pré-requisitos

- Node.js 20+ (testado com 24)
- Docker Desktop (para o PostgreSQL)
- npm 10+

> No Windows, se `npm`/`npx` falharem por política de execução do PowerShell, use `npm.cmd` / `npx.cmd`.

## Como rodar

```bash
# 1. Instalar dependências (raiz do monorepo)
npm install

# 2. Variáveis de ambiente do backend
copy .env.example apps\api\.env   # Windows
# cp .env.example apps/api/.env    # Linux/macOS

# 3. Subir o PostgreSQL
npm run db:up

# 4. Criar as tabelas (primeira migration)
npm run prisma:migrate

# 4.1 Criar o role de runtime (RLS) — uma vez
docker exec -i pdv-db psql -U pdv -d pdv < apps/api/prisma/rls-setup.sql

# 5. Subir API + Web em paralelo
npm run dev
```

> **RLS:** o app conecta como `pdv_app` (via `APP_DATABASE_URL`) para o RLS valer.
> Superusuário (role `pdv`) **ignora** o RLS — use-o só para migrations.

- API: http://localhost:3000/api
- Health check (testa o banco): http://localhost:3000/api/health
- Documentação da API (Swagger): http://localhost:3000/docs
- Web: http://localhost:5173

> Em produção o Swagger fica **desativado por padrão**. Para habilitar, defina
> `ENABLE_SWAGGER=true` no `.env`.

## Scripts (raiz)

| Script | Descrição |
|---|---|
| `npm run dev` | Sobe API e Web juntos |
| `npm run dev:api` | Só a API (watch) |
| `npm run dev:web` | Só o frontend |
| `npm run build` | Build de todos os workspaces |
| `npm run lint` | Lint de todos os workspaces |
| `npm run test` | Testes de todos os workspaces |
| `npm run db:up` / `db:down` | Sobe/derruba o PostgreSQL |
| `npm run prisma:migrate` | Cria/aplica migration |
| `npm run prisma:studio` | Abre o Prisma Studio |
| `npm run db:seed` | Popula uma loja de demonstração (catálogo, clientes, usuário) |

### Dados de demonstração

```bash
npm run db:seed
```

Cria (se não existir) a loja `loja-demonstracao` com categorias, produtos,
clientes e um usuário OWNER (`demo@sistemapdv.com` / `Demo@1234`). É seguro
rodar de novo — não duplica dados. Se o slug já existir com vendas
registradas (loja real), o script aborta em vez de misturar dados nela; use
`SEED_TENANT_SLUG=outro-slug npm run db:seed` para escolher outro slug.

## Deploy (produção)

Há um `docker-compose.prod.yml` com **Postgres + API + Web (nginx) + Caddy (HTTPS)**.

```bash
# 1. Configurar variáveis de produção
cp .env.prod.example .env.prod
# edite .env.prod (domínio, senhas, segredos, CORS, admin da plataforma)

# 2. Subir tudo
docker compose -f docker-compose.prod.yml up -d --build
```

- A API roda **migrations** e configura o **RLS** automaticamente no start.
- O **Caddy** emite o certificado **HTTPS** para o `DOMAIN`.
- O nginx serve o frontend e faz proxy de `/api` para a API.

**Admin da plataforma:** defina os e-mails em `PLATFORM_ADMIN_EMAILS` no `.env.prod` — eles enxergam o menu **Admin**.

**App desktop (Windows):** gere o instalador apontando para a API de produção:

```bash
$env:VITE_API_URL='https://seudominio.com'; npm run build --workspace apps/web
npm run desktop:build
```

O instalador sai em `apps/desktop/src-tauri/target/release/bundle/nsis/`.

### Backup e restauração

- O serviço **`backup`** gera um **dump diário** do banco em `./backups`
  (retenção: 7 diários, 4 semanais, 6 mensais). Ajuste em `.env.prod`.
- **Recomendado:** copiar os backups para **fora do servidor** (bucket
  S3/Cloudflare R2, outro servidor). Exemplo com `rclone` no cron do host:

  ```bash
  rclone sync ./backups remote:pdv-backups
  ```

- Se usar **Postgres gerenciado** (RDS, Neon, Supabase), prefira o backup
  automático do provedor.

**Restaurar um backup:**

```bash
# 1. pare a API para evitar escritas durante a restauração
docker compose -f docker-compose.prod.yml stop api

# 2. restaure o dump (ajuste o caminho/arquivo)
gunzip -c backups/daily/pdv-<data>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U pdv -d pdv

# 3. suba a API novamente
docker compose -f docker-compose.prod.yml start api
```

## Endpoints de autenticação

| Método | Rota | Descrição | Público |
|---|---|---|---|
| POST | `/api/auth/register` | Cria loja (tenant) + usuário OWNER | sim |
| POST | `/api/auth/login` | Login com `tenantSlug` + `email` + `password` | sim |
| POST | `/api/auth/refresh` | Renova tokens a partir do `refreshToken` | sim |
| GET | `/api/auth/me` | Dados do usuário autenticado | não |

Todas as rotas são protegidas por padrão (JWT). Marque rotas públicas com `@Public()`.

### Exemplo de registro

```bash
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"tenantName\":\"Minha Loja\",\"tenantSlug\":\"minha-loja\",\"name\":\"Dono\",\"email\":\"dono@loja.com\",\"password\":\"senha1234\"}"
```

## Estrutura

```
sistema_PDV/
├─ apps/
│  ├─ api/                 # Backend NestJS
│  │  ├─ prisma/
│  │  │  └─ schema.prisma  # Modelo multi-tenant
│  │  ├─ prisma.config.ts  # Config do Prisma 7
│  │  └─ src/
│  │     ├─ prisma/        # PrismaService + PrismaModule
│  │     ├─ health/        # Health check
│  │     └─ generated/     # Client gerado (não versionar)
│  └─ web/                 # Frontend React + Vite
├─ docs/                   # Planejamento e backlog
├─ docker-compose.yml      # PostgreSQL
└─ package.json            # Workspaces
```

## Próximos passos

Ver [`docs/BACKLOG.md`](docs/BACKLOG.md). O próximo item é o **módulo de autenticação** (registro, login, JWT e RBAC).
