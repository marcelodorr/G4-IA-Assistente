# Guia de desenvolvimento — G4 IA Assistente

Este guia é para quem vai trabalhar no código do G4 IA Assistente (o app web e/ou a CLI de instalação).

## Estrutura do monorepo

O projeto é um monorepo com **npm workspaces**:

```
G4-IA-Assistente/
├── apps/
│   └── web/          # aplicação Next.js (chat, admin, API, auth)
├── packages/
│   └── cli/           # CLI publicada no npm como `g4-ia-assistente`
├── Dockerfile          # build de produção (usado pelo deploy no Railway)
├── railway.json        # config de deploy no Railway (build via Dockerfile + healthcheck)
└── package.json         # raiz do workspace
```

- **`apps/web`** — Next.js 16 (App Router), [ai SDK](https://ai-sdk.dev) v7 + `@ai-sdk/openai` para o chat, Auth.js v5 (credentials + JWT), Drizzle ORM sobre Postgres com `pgvector` para a base de conhecimento (RAG).
- **`packages/cli`** — a CLI (`npx g4-ia-assistente`) que provisiona o projeto no Railway do aluno e faz o deploy. Ver [`packages/cli/README.md`](../packages/cli/README.md) para o que ela faz.

## Setup local

O ambiente de desenvolvimento **não usa Docker** — o Postgres de desenvolvimento roda em um projeto Railway próprio para dev, exposto via proxy TCP público (o Dockerfile e o Postgres com `pgvector` da imagem `pgvector/pgvector:pg17` são usados apenas no deploy de produção, veja [Build de produção](#build-de-produção)).

1. **Node.js 22+** (veja `.nvmrc`) e npm.
2. Instale as dependências do monorepo a partir da raiz:
   ```bash
   npm install
   ```
3. Configure o `.env` do app web a partir do exemplo:
   ```bash
   cp apps/web/.env.example apps/web/.env
   ```
   Edite `apps/web/.env` e preencha `DATABASE_URL` e `TEST_DATABASE_URL` com a connection string do seu Postgres de desenvolvimento no Railway (proxy TCP público — algo como `postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway`). O Postgres precisa ter a extensão `pgvector` disponível (use a imagem `pgvector/pgvector:pg17` ao provisionar esse projeto de dev no Railway, pelo mesmo motivo do deploy de produção).
   - `AUTH_SECRET`, `ENCRYPTION_KEY` e `DATA_DIR` já vêm com valores de exemplo no `.env.example`, funcionais para desenvolvimento local.
4. Rode as migrations no banco de dev:
   ```bash
   cd apps/web
   npx drizzle-kit migrate
   ```
5. Suba o servidor de desenvolvimento (a partir da raiz):
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000) — como nenhum usuário existe ainda, você será direcionado para `/setup`.

## Testes

- **App web** (`apps/web`):
  ```bash
  npm test -w apps/web
  ```
  Os testes unitários rodam sempre. Os testes de **integração** (que tocam o banco — schema, RAG, services) são condicionados à variável `TEST_DATABASE_URL` (`describe.skipIf(!process.env.TEST_DATABASE_URL)`): se ela não estiver definida, esses testes são pulados; se estiver (via `apps/web/.env`, carregado automaticamente pelo `vitest.config.ts`), eles rodam contra o banco `g4_test`, criado e migrado automaticamente na primeira execução.
  - O banco remoto tem mais latência, então os arquivos de teste rodam em série (`fileParallelism: false`) — não paralelize manualmente.
- **CLI** (`packages/cli`):
  ```bash
  npm test -w packages/cli
  ```
  Esses testes não tocam infraestrutura real — o `steps.ts` é testado com um runner de processo simulado (fake da Railway CLI).

## Migrations (Drizzle)

O schema fica em `apps/web/lib/db/schema.ts`. Para criar uma nova migration:

1. Edite `apps/web/lib/db/schema.ts` com a mudança desejada.
2. Gere o arquivo SQL da migration (dentro de `apps/web`):
   ```bash
   npx drizzle-kit generate
   ```
3. Aplique a migration no seu banco de dev:
   ```bash
   npx drizzle-kit migrate
   ```
4. Confira o SQL gerado em `apps/web/drizzle/` e faça commit junto com a mudança de schema.

Em produção, as migrations rodam automaticamente no boot do container (`apps/web/scripts/start.mjs`), antes do servidor Next.js subir — não é necessário rodar nada manualmente após o deploy.

## Build de produção

O deploy no Railway (tanto o do aluno via CLI quanto qualquer ambiente próprio) usa o `Dockerfile` da raiz:

- Build multi-stage: instala dependências do workspace `apps/web`, roda `next build` (modo standalone) e monta uma imagem final enxuta (`node:22-alpine`) contendo apenas o output standalone, os estáticos, os arquivos públicos e as migrations do Drizzle.
- No boot, `apps/web/scripts/start.mjs` roda as migrations pendentes contra `DATABASE_URL` e só então inicia o servidor Next.js.
- `railway.json` configura o build via Dockerfile e um healthcheck em `/api/health` (checa conexão com o banco).

Para testar o build de produção localmente:

```bash
docker build -t g4-ia-assistente .
```

## Publicando a CLI

A CLI (`packages/cli`) é publicada no npm como `g4-ia-assistente`. Para publicar uma nova versão:

1. Atualize a versão em `packages/cli/package.json`.
2. Rode os testes: `npm test -w packages/cli`.
3. Publique (o `prepublishOnly` já roda o build via `tsc` automaticamente):
   ```bash
   npm publish -w packages/cli
   ```

Alunos sempre baixam a versão mais recente via `npx g4-ia-assistente` — não é necessário nenhuma outra ação de release.
