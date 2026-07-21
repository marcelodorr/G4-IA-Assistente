# G4 IA Assistente — Plano de Implementação (Parte 1: Aplicação Web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a aplicação Next.js completa do G4 IA Assistente: auth, setup wizard, chat com streaming, assistentes com RAG (pgvector) e área admin.

**Architecture:** Monolito Next.js 15 (App Router) servindo FE + BE, Postgres com pgvector via Drizzle ORM, Auth.js v5 com Credentials/JWT, Vercel AI SDK v5 para streaming/tools/embeddings. Ingestão de documentos roda em background no próprio processo Node.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4 + shadcn/ui, next-auth@5(beta), drizzle-orm + postgres.js, ai (v5) + @ai-sdk/openai + @ai-sdk/react, bcryptjs, unpdf, SheetJS (xlsx via CDN oficial), react-markdown, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-g4-ia-assistente-design.md`

## Global Constraints

- Node >= 22; npm workspaces (`apps/*`, `packages/*`).
- Idioma da UI: **português (pt-BR)** em todas as strings visíveis.
- Identidade G4: navy `#001F35` (fundo), navy claro `#0f1a45`, dourado `#B9915B` (acento/CTA), off-white `#F5F4F3`, borda `#e5e7eb`; fonte Manrope (UI) e Libre Baskerville itálica (acentos display). Tema dark premium.
- Senhas: **bcryptjs** (JS puro — evita falha de build nativo no deploy dos alunos; decisão registrada, spec permitia fallback).
- Embeddings: `text-embedding-3-small`, **1536 dims**. Similaridade: cosseno.
- Modelos curados: `['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini']`; default `gpt-5-mini`. Constante única em `apps/web/lib/ai/models.ts`.
- Uploads: máx **20 MB**; MIME permitidos no chat: `image/png image/jpeg image/webp application/pdf`; na base de conhecimento: `application/pdf` + Excel (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`). Arquivos em `DATA_DIR` (default `/data`; dev `./data`).
- Env vars: `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `DATA_DIR`, `AUTH_TRUST_HOST=true`, `OPENAI_BASE_URL` (opcional, só para testes/mocks).
- Convites: expiração 7 dias, uso único. Roles: `admin` | `member`.
- RAG: chunks ~1800 chars (≈500 tokens) com overlap 200; top-K=8; threshold similaridade 0.25.
- Testes de integração com banco: gated por `TEST_DATABASE_URL` (usar `describe.skipIf(!process.env.TEST_DATABASE_URL)`); rodam contra o Postgres de desenvolvimento hospedado no Railway (sem Docker local — decisão do usuário). O `vitest.config.ts` carrega `apps/web/.env` via `process.loadEnvFile`, então `npx vitest run` funciona sem prefixos.
- Commits frequentes, mensagens em português, prefixos `feat:/fix:/test:/docs:/chore:`.
- Repo: `/Users/guilhermereis/Projects/G4/G4-IA-Assistente` (branch `main`).

## Mapa de arquivos (visão geral)

```
apps/web/
├── app/
│   ├── layout.tsx                      → fontes, tema, Toaster
│   ├── globals.css                     → tokens Tailwind v4 do tema G4
│   ├── (auth)/login/page.tsx           → login
│   ├── (auth)/invite/[token]/page.tsx  → aceitar convite
│   ├── setup/page.tsx                  → wizard 3 passos (client)
│   ├── (app)/layout.tsx                → guarda sessão+setup, sidebar
│   ├── (app)/page.tsx                  → nova conversa
│   ├── (app)/c/[id]/page.tsx           → conversa existente
│   ├── (app)/admin/layout.tsx          → guarda role admin
│   ├── (app)/admin/usuarios/page.tsx
│   ├── (app)/admin/assistentes/page.tsx
│   ├── (app)/admin/assistentes/[id]/page.tsx
│   ├── (app)/admin/configuracoes/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── health/route.ts
│       ├── setup/route.ts              → GET status, POST concluir
│       ├── invites/route.ts            → POST criar (admin), GET listar
│       ├── invites/accept/route.ts     → POST aceitar
│       ├── users/route.ts              → GET listar (admin)
│       ├── users/[id]/route.ts         → PATCH ativar/desativar
│       ├── settings/route.ts           → GET/PATCH (admin)
│       ├── assistants/route.ts         → GET/POST
│       ├── assistants/[id]/route.ts    → GET/PATCH/DELETE
│       ├── assistants/[id]/files/route.ts        → GET/POST upload base
│       ├── assistants/[id]/files/[fileId]/route.ts → DELETE
│       ├── conversations/route.ts      → GET/POST
│       ├── conversations/[id]/route.ts → GET/DELETE
│       ├── upload/route.ts             → POST anexo de chat
│       ├── files/[name]/route.ts       → GET servir arquivo
│       └── chat/route.ts               → POST streaming
├── components/
│   ├── brand/logo.tsx
│   ├── chat/{chat.tsx, message-list.tsx, message-input.tsx, markdown.tsx, model-picker.tsx, assistant-picker.tsx}
│   ├── sidebar/{sidebar.tsx, conversation-list.tsx}
│   ├── setup/setup-wizard.tsx
│   └── admin/{users-table.tsx, invite-dialog.tsx, assistant-form.tsx, assistant-files.tsx, settings-form.tsx}
├── lib/
│   ├── db/{index.ts, schema.ts}
│   ├── crypto.ts
│   ├── auth/{config.ts, index.ts, password.ts, verify-credentials.ts}
│   ├── ai/{models.ts, provider.ts, system-prompt.ts, prepare-messages.ts, title.ts, knowledge-tool.ts}
│   ├── rag/{chunking.ts, extract.ts, ingest.ts, search.ts}
│   ├── files/storage.ts
│   └── services/{settings.ts, setup.ts, invites.ts, users.ts, assistants.ts, conversations.ts}
├── drizzle/                            → migrations SQL geradas
├── drizzle.config.ts
├── middleware.ts
├── vitest.config.ts
└── test/{helpers/db.ts, fixtures/{exemplo.pdf, exemplo.xlsx}}
```

---

## Fase 0 — Fundação

### Task 1: Monorepo + scaffold Next.js

**Files:**
- Create: `package.json` (raiz), `.gitignore`, `docker-compose.yml`, `apps/web/*` (via create-next-app)

**Interfaces:**
- Produces: workspace npm `apps/web` buildável; Postgres pgvector local em `localhost:5432` (user/senha `postgres`, db `g4`).

- [ ] **Step 1: Criar package.json raiz e .gitignore**

`package.json`:
```json
{
  "name": "g4-ia-assistente",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w apps/web",
    "build": "npm run build -w apps/web",
    "test": "npm run test -w apps/web"
  },
  "engines": { "node": ">=22" }
}
```

`.gitignore`:
```
node_modules/
.next/
.env
.env.local
data/
dist/
*.tsbuildinfo
```

- [ ] **Step 2: Scaffold Next.js**

```bash
cd /Users/guilhermereis/Projects/G4/G4-IA-Assistente
npx create-next-app@latest apps/web --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --turbopack --yes
```
Depois editar `apps/web/package.json`: `"name": "web"`. Remover `apps/web/.git` se criado, e `apps/web/package-lock.json` (lock fica na raiz).

- [ ] **Step 3: Banco de desenvolvimento (Railway, sem Docker)**

Não há Docker local. O banco de dev é um Postgres com pgvector num projeto Railway de desenvolvimento, acessado pelo TCP proxy público. As URLs (`DATABASE_URL`/`TEST_DATABASE_URL`) ficam em `apps/web/.env` (Task 3) — o controlador fornece os valores reais.

- [ ] **Step 4: Instalar e verificar build**

```bash
npm install
npm run build
```
Esperado: build do Next.js conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: monorepo com scaffold Next.js e Postgres pgvector de dev"
```

### Task 2: Tema G4 + assets de marca

**Files:**
- Create: `apps/web/public/brand/logo-branca.svg`, `apps/web/public/brand/logo-escura.svg`, `apps/web/components/brand/logo.tsx`
- Modify: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`

**Interfaces:**
- Produces: tokens CSS `--background/--foreground/--primary/...` (padrão shadcn) com paleta G4; componente `<Logo variant="branca" | "escura" className?>`; fontes `--font-sans` (Manrope) e `--font-serif` (Libre Baskerville).

- [ ] **Step 1: Baixar logos**

```bash
curl -sL "https://g4business.com/wp-content/uploads/2026/01/logo-g4-completa-branca.svg" -o apps/web/public/brand/logo-branca.svg
curl -sL "https://g4business.com/wp-content/uploads/2026/01/g4educacao-logo-escura.svg" -o apps/web/public/brand/logo-escura.svg
```
Verificar que ambos começam com `<svg` (`head -c 200 apps/web/public/brand/*.svg`).

- [ ] **Step 2: Inicializar shadcn/ui**

```bash
cd apps/web && npx shadcn@latest init -y -b neutral && npx shadcn@latest add button input label card dialog select textarea dropdown-menu avatar badge table sonner tooltip skeleton
```

- [ ] **Step 3: Tokens do tema em globals.css**

Substituir as variáveis de cor geradas pelo shadcn em `apps/web/app/globals.css` (bloco `:root` — o app é dark-only, sem bloco `.dark`) por:
```css
:root {
  --background: #06121d;          /* navy quase preto (fundo geral) */
  --foreground: #F5F4F3;
  --card: #0b1f30;                /* navy card, derivado de #001F35 */
  --card-foreground: #F5F4F3;
  --popover: #0b1f30;
  --popover-foreground: #F5F4F3;
  --primary: #B9915B;             /* dourado G4 */
  --primary-foreground: #06121d;
  --secondary: #0f1a45;
  --secondary-foreground: #F5F4F3;
  --muted: #12293c;
  --muted-foreground: #9ca3af;
  --accent: #12293c;
  --accent-foreground: #F5F4F3;
  --destructive: #af4332;
  --border: rgba(245, 244, 243, 0.12);
  --input: rgba(245, 244, 243, 0.16);
  --ring: #B9915B;
  --radius: 0.75rem;
}
```

- [ ] **Step 4: Fontes e layout raiz**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Manrope, Libre_Baskerville } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const baskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "G4 IA Assistente",
  description: "Assistente de IA do G4 para o seu negócio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${manrope.variable} ${baskerville.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

`apps/web/components/brand/logo.tsx`:
```tsx
import Image from "next/image";

export function Logo({ variant = "branca", className = "h-8 w-auto" }: { variant?: "branca" | "escura"; className?: string }) {
  return <Image src={`/brand/logo-${variant}.svg`} alt="G4" width={120} height={32} className={className} priority />;
}
```

Substituir `apps/web/app/page.tsx` por um placeholder temporário (será trocado na Task 12):
```tsx
import { Logo } from "@/components/brand/logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo />
      <p className="text-muted-foreground">G4 IA Assistente — em construção</p>
    </main>
  );
}
```

- [ ] **Step 5: Verificar e commitar**

```bash
npm run build && git add -A && git commit -m "feat: tema G4 (navy/dourado), fontes e logos"
```

### Task 3: Drizzle + schema + migrations

**Files:**
- Create: `apps/web/lib/db/schema.ts`, `apps/web/lib/db/index.ts`, `apps/web/drizzle.config.ts`, `apps/web/.env.example`, `apps/web/.env`, `apps/web/test/helpers/db.ts`, `apps/web/vitest.config.ts`
- Test: `apps/web/lib/db/schema.test.ts`

**Interfaces:**
- Produces: `db` (drizzle client singleton), tabelas `users, invites, settings, assistants, assistantFiles, chunks, conversations, messages` exportadas de `@/lib/db/schema`; helper de teste `getTestDb()` que roda migrations e trunca tabelas.

- [ ] **Step 1: Instalar dependências**

```bash
cd apps/web && npm i drizzle-orm postgres && npm i -D drizzle-kit vitest @vitest/coverage-v8
```

- [ ] **Step 2: Escrever schema**

`apps/web/lib/db/schema.ts`:
```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, vector, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  openaiKeyEncrypted: text("openai_key_encrypted"),
  defaultModel: text("default_model").notNull().default("gpt-5-mini"),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistants = pgTable("assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assistantFiles = pgTable("assistant_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  assistantId: uuid("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => assistantFiles.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
}, (t) => [
  index("chunks_assistant_idx").on(t.assistantId),
  index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  title: text("title"),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

`apps/web/lib/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(client, { schema });
export type Db = typeof db;
```

`apps/web/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`apps/web/.env.example` (copiar para `.env`; as URLs reais do Postgres de dev no Railway são fornecidas pelo controlador):
```
# Postgres de desenvolvimento (projeto Railway de dev — TCP proxy público)
DATABASE_URL=postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway
TEST_DATABASE_URL=postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/g4_test
AUTH_SECRET=dev-secret-troque-em-producao
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
DATA_DIR=./data
AUTH_TRUST_HOST=true
```

- [ ] **Step 3: Gerar migration e adicionar CREATE EXTENSION**

```bash
cd apps/web && npx drizzle-kit generate --name init
```
Editar o arquivo gerado `apps/web/drizzle/0000_init.sql`: adicionar como **primeira linha**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 4: Aplicar no banco de dev**

```bash
cd apps/web && npx drizzle-kit migrate
psql "$DATABASE_URL" -c "\dt"
```
Esperado: as 8 tabelas listadas. (`drizzle-kit` lê o `.env` automaticamente; para o psql, exporte `DATABASE_URL` do `.env` antes.)

- [ ] **Step 5: Helper de teste + vitest config**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { existsSync } from "fs";
import path from "path";

// carrega o .env local (URLs do Postgres de dev no Railway) para os testes
const envFile = path.resolve(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts", "test/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
```
Adicionar em `apps/web/package.json` scripts: `"test": "vitest run"`.

`apps/web/test/helpers/db.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getTestDb() {
  const url = process.env.TEST_DATABASE_URL!;
  if (!testDb) {
    // cria o database g4_test se não existir
    const admin = postgres(url.replace(/\/[^/]+$/, "/postgres"));
    const dbName = url.split("/").pop()!;
    const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    await admin.end();
    const client = postgres(url, { max: 3 });
    testDb = drizzle(client, { schema });
    await migrate(testDb, { migrationsFolder: "./drizzle" });
  }
  return testDb;
}

export async function truncateAll() {
  const db = await getTestDb();
  await db.execute(sql`TRUNCATE users, invites, settings, assistants, assistant_files, chunks, conversations, messages CASCADE`);
}
```

- [ ] **Step 6: Teste de fumaça do schema**

`apps/web/lib/db/schema.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { users } from "./schema";

describe.skipIf(!process.env.TEST_DATABASE_URL)("schema", () => {
  beforeEach(truncateAll);

  it("insere e lê um usuário", async () => {
    const db = await getTestDb();
    const [u] = await db.insert(users).values({ name: "Teste", email: "t@g4.com", passwordHash: "x" }).returning();
    expect(u.role).toBe("member");
    expect(u.active).toBe(true);
  });
});
```
Rodar: `npx vitest run lib/db` (o vitest.config carrega o `.env` com `TEST_DATABASE_URL`) — esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: schema Drizzle com pgvector e infra de testes de banco"
```

### Task 4: Módulo de criptografia (AES-256-GCM)

**Files:**
- Create: `apps/web/lib/crypto.ts`
- Test: `apps/web/lib/crypto.test.ts`

**Interfaces:**
- Produces: `encrypt(plain: string): string` (formato `iv.cipher.tag` em base64) e `decrypt(payload: string): string`; ambas usam `process.env.ENCRYPTION_KEY` (64 hex).

- [ ] **Step 1: Teste que falha**

`apps/web/lib/crypto.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  it("roundtrip encrypt/decrypt", () => {
    const payload = encrypt("sk-test-123");
    expect(payload).not.toContain("sk-test-123");
    expect(decrypt(payload)).toBe("sk-test-123");
  });

  it("payloads diferentes para o mesmo texto (IV aleatório)", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });

  it("falha se o payload for adulterado", () => {
    const p = encrypt("segredo");
    const [iv, data, tag] = p.split(".");
    const tampered = [iv, Buffer.from("aaaa").toString("base64"), tag].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("falha com chave inválida", () => {
    process.env.ENCRYPTION_KEY = "curta";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/crypto` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`apps/web/lib/crypto.ts`:
```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, data, cipher.getAuthTag()].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, data, tag] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/crypto` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: criptografia AES-256-GCM para a chave OpenAI"`

### Task 5: Serviço de settings

**Files:**
- Create: `apps/web/lib/services/settings.ts`, `apps/web/lib/ai/models.ts`
- Test: `apps/web/lib/services/settings.test.ts`

**Interfaces:**
- Produces:
  - `SUPPORTED_MODELS: string[]`, `DEFAULT_MODEL = "gpt-5-mini"` (de `@/lib/ai/models`)
  - `getSettings(db): Promise<{ defaultModel: string; setupCompleted: boolean; hasKey: boolean }>`
  - `saveOpenAIKey(db, key: string)`, `getOpenAIKey(db): Promise<string>` (descriptografada; lança se ausente)
  - `setDefaultModel(db, model: string)` (valida contra SUPPORTED_MODELS ou aceita string custom não-vazia)
  - Todas recebem `db` como primeiro parâmetro (injeção p/ testes).

- [ ] **Step 1: Constantes de modelos**

`apps/web/lib/ai/models.ts`:
```ts
export const SUPPORTED_MODELS = ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"];
export const DEFAULT_MODEL = "gpt-5-mini";
```

- [ ] **Step 2: Teste que falha**

`apps/web/lib/services/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { getSettings, saveOpenAIKey, getOpenAIKey, setDefaultModel } from "./settings";

describe.skipIf(!process.env.TEST_DATABASE_URL)("settings", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    await truncateAll();
  });

  it("retorna defaults quando não há linha", async () => {
    const db = await getTestDb();
    const s = await getSettings(db);
    expect(s.setupCompleted).toBe(false);
    expect(s.hasKey).toBe(false);
    expect(s.defaultModel).toBe("gpt-5-mini");
  });

  it("salva chave criptografada e lê descriptografada", async () => {
    const db = await getTestDb();
    await saveOpenAIKey(db, "sk-abc");
    expect(await getOpenAIKey(db)).toBe("sk-abc");
    const s = await getSettings(db);
    expect(s.hasKey).toBe(true);
  });

  it("getOpenAIKey lança quando não configurada", async () => {
    const db = await getTestDb();
    await expect(getOpenAIKey(db)).rejects.toThrow(/não configurada/);
  });

  it("setDefaultModel rejeita vazio", async () => {
    const db = await getTestDb();
    await expect(setDefaultModel(db, " ")).rejects.toThrow();
    await setDefaultModel(db, "gpt-4o");
    expect((await getSettings(db)).defaultModel).toBe("gpt-4o");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run lib/services/settings` → FAIL.

- [ ] **Step 4: Implementar**

`apps/web/lib/services/settings.ts`:
```ts
import { eq } from "drizzle-orm";
import { settings } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import type { Db } from "@/lib/db";

async function getRow(db: Db) {
  return (await db.select().from(settings).where(eq(settings.id, 1)))[0] ?? null;
}

async function upsert(db: Db, values: Partial<typeof settings.$inferInsert>) {
  await db.insert(settings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: settings.id, set: { ...values, updatedAt: new Date() } });
}

export async function getSettings(db: Db) {
  const row = await getRow(db);
  return {
    defaultModel: row?.defaultModel ?? DEFAULT_MODEL,
    setupCompleted: row?.setupCompleted ?? false,
    hasKey: Boolean(row?.openaiKeyEncrypted),
  };
}

export async function saveOpenAIKey(db: Db, key: string) {
  if (!key.trim()) throw new Error("Chave OpenAI vazia");
  await upsert(db, { openaiKeyEncrypted: encrypt(key.trim()) });
}

export async function getOpenAIKey(db: Db): Promise<string> {
  const row = await getRow(db);
  if (!row?.openaiKeyEncrypted) throw new Error("Chave OpenAI não configurada");
  return decrypt(row.openaiKeyEncrypted);
}

export async function setDefaultModel(db: Db, model: string) {
  if (!model.trim()) throw new Error("Modelo inválido");
  await upsert(db, { defaultModel: model.trim() });
}

export async function markSetupCompleted(db: Db) {
  await upsert(db, { setupCompleted: true });
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run lib/services/settings` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: serviço de settings com chave OpenAI criptografada"`

---

## Fase 1 — Auth, Setup e Usuários

### Task 6: Auth.js (Credentials + JWT) + login

**Files:**
- Create: `apps/web/lib/auth/password.ts`, `apps/web/lib/auth/verify-credentials.ts`, `apps/web/lib/auth/config.ts`, `apps/web/lib/auth/index.ts`, `apps/web/app/api/auth/[...nextauth]/route.ts`, `apps/web/middleware.ts`, `apps/web/app/(auth)/login/page.tsx`, `apps/web/components/auth/login-form.tsx`, `apps/web/types/next-auth.d.ts`
- Test: `apps/web/lib/auth/password.test.ts`, `apps/web/lib/auth/verify-credentials.test.ts`

**Interfaces:**
- Consumes: `users` de `@/lib/db/schema`.
- Produces:
  - `hashPassword(plain): Promise<string>`, `verifyPassword(plain, hash): Promise<boolean>`
  - `verifyCredentials(email, password, findUser?): Promise<{id, name, email, role} | null>`
  - `auth()`, `signIn`, `signOut`, `handlers` de `@/lib/auth`
  - Sessão JWT com `session.user.id` e `session.user.role`.

- [ ] **Step 1: Instalar deps** — `cd apps/web && npm i next-auth@beta bcryptjs && npm i -D @types/bcryptjs`

- [ ] **Step 2: Testes que falham**

`apps/web/lib/auth/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hash e verificação", async () => {
    const hash = await hashPassword("senha123");
    expect(hash).not.toBe("senha123");
    expect(await verifyPassword("senha123", hash)).toBe(true);
    expect(await verifyPassword("errada", hash)).toBe(false);
  });
});
```

`apps/web/lib/auth/verify-credentials.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { verifyCredentials } from "./verify-credentials";
import { hashPassword } from "./password";

describe("verifyCredentials", () => {
  const makeUser = async (over = {}) => ({
    id: "u1", name: "Ana", email: "ana@g4.com", role: "member" as const,
    active: true, passwordHash: await hashPassword("senha123"), createdAt: new Date(), ...over,
  });

  it("retorna usuário com credenciais corretas (email normalizado)", async () => {
    const user = await makeUser();
    const result = await verifyCredentials("  ANA@g4.com ", "senha123", async () => user);
    expect(result).toEqual({ id: "u1", name: "Ana", email: "ana@g4.com", role: "member" });
  });

  it("null para senha errada", async () => {
    const user = await makeUser();
    expect(await verifyCredentials("ana@g4.com", "x", async () => user)).toBeNull();
  });

  it("null para usuário inexistente ou inativo", async () => {
    expect(await verifyCredentials("x@x.com", "s", async () => null)).toBeNull();
    const inativo = await makeUser({ active: false });
    expect(await verifyCredentials("ana@g4.com", "senha123", async () => inativo)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run lib/auth` → FAIL.

- [ ] **Step 4: Implementar password e verify-credentials**

`apps/web/lib/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

`apps/web/lib/auth/verify-credentials.ts`:
```ts
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import type { users } from "@/lib/db/schema";

type UserRow = typeof users.$inferSelect;
type FindUser = (email: string) => Promise<UserRow | null>;

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  return (await db.select().from(users).where(eq(users.email, email)))[0] ?? null;
}

export async function verifyCredentials(email: string, password: string, findUser: FindUser = findUserByEmail) {
  const user = await findUser(email.trim().toLowerCase());
  if (!user || !user.active) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run lib/auth` → PASS.

- [ ] **Step 6: Configuração NextAuth (split edge-safe)**

`apps/web/lib/auth/config.ts` (sem imports de banco — usado no middleware/edge):
```ts
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const publica = ["/login", "/setup"].some((p) => pathname.startsWith(p))
        || pathname.startsWith("/invite/")
        || pathname.startsWith("/api/auth")      // endpoints internos do NextAuth (csrf/session/callback)
        || pathname.startsWith("/api/setup")
        || pathname.startsWith("/api/invites/accept")
        || pathname.startsWith("/api/health")
        || pathname.startsWith("/brand/");
      if (publica) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "member";
      return session;
    },
  },
} satisfies NextAuthConfig;
```

`apps/web/lib/auth/index.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { verifyCredentials } from "./verify-credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        return verifyCredentials(creds.email as string, creds.password as string);
      },
    }),
  ],
});
```

`apps/web/types/next-auth.d.ts`:
```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; role: "admin" | "member" };
  }
  interface User { role: "admin" | "member" }
}
```

`apps/web/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

`apps/web/middleware.ts`:
```ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
```

- [ ] **Step 7: Página de login**

`apps/web/components/auth/login-form.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: data.get("email"), password: data.get("password"), redirect: false,
    });
    setCarregando(false);
    if (res?.error) setErro("E-mail ou senha incorretos.");
    else { router.push("/"); router.refresh(); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
```

`apps/web/app/(auth)/login/page.tsx`:
```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4">
          <Logo />
          <p className="font-serif italic text-muted-foreground">Para quem quer mais</p>
        </CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    </main>
  );
}
```
Nota: `signIn` client-side vem de `next-auth/react`.

- [ ] **Step 8: Verificar build e commitar**

```bash
npm run build && git add -A && git commit -m "feat: autenticação Auth.js com credentials, JWT e página de login"
```

### Task 7: Setup wizard (primeiro acesso)

**Files:**
- Create: `apps/web/lib/services/setup.ts`, `apps/web/app/api/setup/route.ts`, `apps/web/app/setup/page.tsx`, `apps/web/components/setup/setup-wizard.tsx`, `apps/web/lib/services/guards.ts`
- Test: `apps/web/lib/services/setup.test.ts`

**Interfaces:**
- Consumes: `getSettings/saveOpenAIKey/setDefaultModel/markSetupCompleted`, `hashPassword`.
- Produces:
  - `isSetupCompleted(db): Promise<boolean>`
  - `completeSetup(db, input, deps?): Promise<void>` — input `{ name, email, password, openaiKey, defaultModel }`; deps `{ validateKey(key): Promise<boolean> }`
  - `validateOpenAIKey(key): Promise<boolean>` — GET `${OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/models` com Bearer; true se status 200
  - Guard `requireAdmin()` e `requireSession()` em `guards.ts` (retornam sessão ou lançam `Response` 401/403)
  - API: `GET /api/setup` → `{ setupCompleted }`; `POST /api/setup` → 204 ou 400/409 com `{ error }`.

- [ ] **Step 1: Teste que falha**

`apps/web/lib/services/setup.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { completeSetup, isSetupCompleted } from "./setup";
import { getOpenAIKey } from "./settings";
import { verifyCredentials } from "@/lib/auth/verify-credentials";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const input = { name: "Admin", email: "Admin@G4.com", password: "senha123", openaiKey: "sk-ok", defaultModel: "gpt-5-mini" };
const okKey = async () => true;

describe.skipIf(!process.env.TEST_DATABASE_URL)("setup", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = "c".repeat(64);
    await truncateAll();
  });

  it("cria admin, salva chave e marca concluído", async () => {
    const db = await getTestDb();
    await completeSetup(db, input, { validateKey: okKey });
    expect(await isSetupCompleted(db)).toBe(true);
    expect(await getOpenAIKey(db)).toBe("sk-ok");
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@g4.com"));
    expect(admin.role).toBe("admin");
    // senha funciona no login
    expect(await verifyCredentials("admin@g4.com", "senha123", async () => admin)).not.toBeNull();
  });

  it("recusa segunda execução", async () => {
    const db = await getTestDb();
    await completeSetup(db, input, { validateKey: okKey });
    await expect(completeSetup(db, input, { validateKey: okKey })).rejects.toThrow(/já configurado/);
  });

  it("recusa chave OpenAI inválida", async () => {
    const db = await getTestDb();
    await expect(completeSetup(db, input, { validateKey: async () => false })).rejects.toThrow(/chave/i);
    expect(await isSetupCompleted(db)).toBe(false);
  });

  it("valida senha mínima de 8 caracteres", async () => {
    const db = await getTestDb();
    await expect(completeSetup(db, { ...input, password: "1234567" }, { validateKey: okKey })).rejects.toThrow(/senha/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/services/setup` → FAIL.

- [ ] **Step 3: Implementar serviço**

`apps/web/lib/services/setup.ts`:
```ts
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { getSettings, saveOpenAIKey, setDefaultModel, markSetupCompleted } from "./settings";
import type { Db } from "@/lib/db";

export async function isSetupCompleted(db: Db) {
  return (await getSettings(db)).setupCompleted;
}

export async function validateOpenAIKey(key: string): Promise<boolean> {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetch(`${base.replace(/\/v1$/, "")}/v1/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok;
}

type SetupInput = { name: string; email: string; password: string; openaiKey: string; defaultModel: string };

export async function completeSetup(db: Db, input: SetupInput, deps = { validateKey: validateOpenAIKey }) {
  if (await isSetupCompleted(db)) throw new Error("O sistema já está configurado");
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (!input.name.trim() || !input.email.includes("@")) throw new Error("Nome ou e-mail inválido");
  if (!(await deps.validateKey(input.openaiKey.trim()))) throw new Error("Chave OpenAI inválida — verifique e tente novamente");

  await db.insert(users).values({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: "admin",
  });
  await saveOpenAIKey(db, input.openaiKey);
  await setDefaultModel(db, input.defaultModel);
  await markSetupCompleted(db);
}
```

`apps/web/lib/services/guards.ts`:
```ts
import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw Response.json({ error: "Não autenticado" }, { status: 401 });
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw Response.json({ error: "Apenas administradores" }, { status: 403 });
  return session;
}
```
Padrão de uso nas rotas: `try { ... } catch (e) { if (e instanceof Response) return e; throw e; }` — criar também helper `apiHandler`:
```ts
export function apiHandler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try { return await fn(req, ctx); }
    catch (e) {
      if (e instanceof Response) return e;
      const msg = e instanceof Error ? e.message : "Erro interno";
      return Response.json({ error: msg }, { status: 400 });
    }
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/services/setup` → PASS.

- [ ] **Step 5: Rota API**

`apps/web/app/api/setup/route.ts`:
```ts
import { db } from "@/lib/db";
import { isSetupCompleted, completeSetup } from "@/lib/services/setup";
import { apiHandler } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  return Response.json({ setupCompleted: await isSetupCompleted(db) });
});

export const POST = apiHandler(async (req) => {
  if (await isSetupCompleted(db)) return Response.json({ error: "Já configurado" }, { status: 409 });
  await completeSetup(db, await req.json());
  return new Response(null, { status: 204 });
});
```

- [ ] **Step 6: Wizard UI**

`apps/web/components/setup/setup-wizard.tsx` — client component com 3 passos em estado local (`passo: 1|2|3`), guardando `{name,email,password}` e `{openaiKey}`; no passo 3 seleciona modelo (`Select` com SUPPORTED_MODELS) e envia POST `/api/setup`; sucesso → `signIn("credentials", { email, password, redirectTo: "/" })` para logar direto. Estrutura:
```tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { SUPPORTED_MODELS, DEFAULT_MODEL } from "@/lib/ai/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/brand/logo";

export function SetupWizard() {
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", openaiKey: "", defaultModel: DEFAULT_MODEL });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function concluir() {
    setEnviando(true); setErro(null);
    const res = await fetch("/api/setup", { method: "POST", body: JSON.stringify(form) });
    if (!res.ok) {
      setErro((await res.json()).error ?? "Erro ao configurar");
      setEnviando(false);
      return;
    }
    await signIn("credentials", { email: form.email, password: form.password, redirectTo: "/" });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center space-y-3">
        <Logo />
        <p className="text-sm text-muted-foreground">Configuração inicial — passo {passo} de 3</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {passo === 1 && (<>
          <div className="space-y-2"><Label>Seu nome</Label><Input value={form.name} onChange={set("name")} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
          <div className="space-y-2"><Label>Senha (mín. 8 caracteres)</Label><Input type="password" value={form.password} onChange={set("password")} /></div>
          <Button className="w-full" disabled={!form.name || !form.email || form.password.length < 8} onClick={() => setPasso(2)}>Continuar</Button>
        </>)}
        {passo === 2 && (<>
          <div className="space-y-2">
            <Label>Chave da OpenAI</Label>
            <Input type="password" placeholder="sk-..." value={form.openaiKey} onChange={set("openaiKey")} />
            <p className="text-xs text-muted-foreground">Crie em platform.openai.com/api-keys. A chave fica criptografada no seu banco.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPasso(1)}>Voltar</Button>
            <Button className="flex-1" disabled={!form.openaiKey.startsWith("sk-")} onClick={() => setPasso(3)}>Continuar</Button>
          </div>
        </>)}
        {passo === 3 && (<>
          <div className="space-y-2">
            <Label>Modelo padrão</Label>
            <Select value={form.defaultModel} onValueChange={(v) => setForm({ ...form, defaultModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPORTED_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPasso(2)}>Voltar</Button>
            <Button className="flex-1" disabled={enviando} onClick={concluir}>{enviando ? "Configurando..." : "Concluir"}</Button>
          </div>
        </>)}
      </CardContent>
    </Card>
  );
}
```

`apps/web/app/setup/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isSetupCompleted } from "@/lib/services/setup";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupCompleted(db)) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <SetupWizard />
    </main>
  );
}
```

Adicionar guarda inversa no login: em `apps/web/app/(auth)/login/page.tsx`, no topo do componente (torná-lo async):
```tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isSetupCompleted } from "@/lib/services/setup";
export const dynamic = "force-dynamic";
// dentro do componente:
if (!(await isSetupCompleted(db))) redirect("/setup");
```

- [ ] **Step 7: Verificação manual**

```bash
npm run dev -w apps/web
```
Abrir http://localhost:3000 → deve redirecionar (via layout futuro; por ora acessar /setup direto), completar wizard com chave real ou `OPENAI_BASE_URL` mockada; conferir linha em `settings` e usuário admin no banco.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: setup wizard de primeiro acesso com validação da chave OpenAI"`

### Task 8: Convites e gestão de usuários

**Files:**
- Create: `apps/web/lib/services/invites.ts`, `apps/web/lib/services/users.ts`, `apps/web/app/api/invites/route.ts`, `apps/web/app/api/invites/accept/route.ts`, `apps/web/app/api/users/route.ts`, `apps/web/app/api/users/[id]/route.ts`, `apps/web/app/(auth)/invite/[token]/page.tsx`, `apps/web/components/auth/accept-invite-form.tsx`, `apps/web/app/(app)/admin/usuarios/page.tsx`, `apps/web/components/admin/users-table.tsx`, `apps/web/components/admin/invite-dialog.tsx`
- Test: `apps/web/lib/services/invites.test.ts`

**Interfaces:**
- Produces:
  - `createInvite(db, { email, role }): Promise<{ token: string }>` — token `randomBytes(32).toString("base64url")`, expira em 7 dias
  - `getValidInvite(db, token): Promise<InviteRow | null>` — null se usado/expirado
  - `acceptInvite(db, token, { name, password }): Promise<void>` — cria user, marca `usedAt`; lança se inválido/e-mail já cadastrado
  - `listUsers(db)`, `setUserActive(db, id, active)` — proibido desativar o último admin ativo
  - APIs: `POST /api/invites` (admin) → `{ url }`; `GET /api/invites` (admin); `POST /api/invites/accept` `{ token, name, password }`; `GET /api/users` (admin); `PATCH /api/users/[id]` `{ active }` (admin).

- [ ] **Step 1: Teste que falha**

`apps/web/lib/services/invites.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { createInvite, getValidInvite, acceptInvite } from "./invites";
import { setUserActive } from "./users";
import { users, invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";

describe.skipIf(!process.env.TEST_DATABASE_URL)("invites", () => {
  beforeEach(truncateAll);

  it("cria convite válido por 7 dias e aceita uma única vez", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "novo@g4.com", role: "member" });
    expect(token.length).toBeGreaterThan(30);
    expect(await getValidInvite(db, token)).not.toBeNull();

    await acceptInvite(db, token, { name: "Novo", password: "senha123!" });
    const [u] = await db.select().from(users).where(eq(users.email, "novo@g4.com"));
    expect(u.role).toBe("member");
    expect(await getValidInvite(db, token)).toBeNull(); // já usado
    await expect(acceptInvite(db, token, { name: "X", password: "senha123!" })).rejects.toThrow(/inválido/i);
  });

  it("rejeita convite expirado", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "a@b.com", role: "member" });
    await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.token, token));
    expect(await getValidInvite(db, token)).toBeNull();
  });

  it("não desativa o último admin ativo", async () => {
    const db = await getTestDb();
    const [admin] = await db.insert(users).values({
      name: "Adm", email: "adm@g4.com", passwordHash: await hashPassword("x".repeat(8)), role: "admin",
    }).returning();
    await expect(setUserActive(db, admin.id, false)).rejects.toThrow(/último admin/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/services/invites` → FAIL.

- [ ] **Step 3: Implementar serviços**

`apps/web/lib/services/invites.ts`:
```ts
import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { invites, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(db: Db, input: { email: string; role: "admin" | "member" }) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(invites).values({
    token,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    expiresAt: new Date(Date.now() + SETE_DIAS_MS),
  });
  return { token };
}

export async function getValidInvite(db: Db, token: string) {
  const rows = await db.select().from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedAt), gt(invites.expiresAt, new Date())));
  return rows[0] ?? null;
}

export async function acceptInvite(db: Db, token: string, input: { name: string; password: string }) {
  const invite = await getValidInvite(db, token);
  if (!invite) throw new Error("Convite inválido ou expirado");
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  const existing = await db.select().from(users).where(eq(users.email, invite.email));
  if (existing.length > 0) throw new Error("Este e-mail já possui conta");
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      name: input.name.trim(), email: invite.email,
      passwordHash: await hashPassword(input.password), role: invite.role,
    });
    await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));
  });
}
```

`apps/web/lib/services/users.ts`:
```ts
import { and, eq, ne } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function listUsers(db: Db) {
  return db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, active: users.active, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
}

export async function setUserActive(db: Db, id: string, active: boolean) {
  if (!active) {
    const outrosAdmins = await db.select().from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id)));
    const [alvo] = await db.select().from(users).where(eq(users.id, id));
    if (alvo?.role === "admin" && outrosAdmins.length === 0) {
      throw new Error("Não é possível desativar o último admin ativo");
    }
  }
  await db.update(users).set({ active }).where(eq(users.id, id));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/services` → PASS.

- [ ] **Step 5: Rotas API**

`apps/web/app/api/invites/route.ts`:
```ts
import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { createInvite } from "@/lib/services/invites";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { desc } from "drizzle-orm";

export const POST = apiHandler(async (req) => {
  await requireAdmin();
  const { email, role = "member" } = await req.json();
  if (!email?.includes("@")) return Response.json({ error: "E-mail inválido" }, { status: 400 });
  const { token } = await createInvite(db, { email, role });
  const base = new URL(req.url).origin;
  return Response.json({ url: `${base}/invite/${token}` });
});

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await db.select().from(invites).orderBy(desc(invites.createdAt)));
});
```

`apps/web/app/api/invites/accept/route.ts`:
```ts
import { db } from "@/lib/db";
import { acceptInvite } from "@/lib/services/invites";
import { apiHandler } from "@/lib/services/guards";

export const POST = apiHandler(async (req) => {
  const { token, name, password } = await req.json();
  await acceptInvite(db, token, { name, password });
  return new Response(null, { status: 204 });
});
```

`apps/web/app/api/users/route.ts`:
```ts
import { db } from "@/lib/db";
import { listUsers } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await listUsers(db));
});
```

`apps/web/app/api/users/[id]/route.ts`:
```ts
import { db } from "@/lib/db";
import { setUserActive } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { active } = await req.json();
  await setUserActive(db, id, Boolean(active));
  return new Response(null, { status: 204 });
});
```

- [ ] **Step 6: Página aceitar convite**

`apps/web/components/auth/accept-invite-form.tsx` — client: campos nome + senha, POST `/api/invites/accept` com token via prop; sucesso → `signIn("credentials", { email, password, redirectTo: "/" })` (recebe email por prop). Erro → mensagem.

`apps/web/app/(auth)/invite/[token]/page.tsx`:
```tsx
import { db } from "@/lib/db";
import { getValidInvite } from "@/lib/services/invites";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getValidInvite(db, token);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-3">
          <Logo />
          {invite
            ? <p className="text-sm text-muted-foreground">Criar conta para <b>{invite.email}</b></p>
            : <p className="text-sm text-destructive">Convite inválido ou expirado. Peça um novo ao administrador.</p>}
        </CardHeader>
        {invite && <CardContent><AcceptInviteForm token={token} email={invite.email} /></CardContent>}
      </Card>
    </main>
  );
}
```

- [ ] **Step 7: Página admin de usuários**

`apps/web/app/(app)/admin/usuarios/page.tsx` — server component: chama `listUsers(db)` e renderiza `<UsersTable users={...} />` + `<InviteDialog />`.
`apps/web/components/admin/users-table.tsx` — client: tabela shadcn (nome, e-mail, role Badge, status, botão Ativar/Desativar → PATCH `/api/users/[id]`, `router.refresh()` após sucesso, toast de erro).
`apps/web/components/admin/invite-dialog.tsx` — client: Dialog com input e-mail + select role, POST `/api/invites`, exibe a URL gerada com botão "Copiar link" (`navigator.clipboard.writeText`).

- [ ] **Step 8: Build + commit**

```bash
npm run build && git add -A && git commit -m "feat: convites com expiração e gestão de usuários no admin"
```

---

## Fase 2 — Chat

### Task 9: Conversas (serviço + API + layout com sidebar)

**Files:**
- Create: `apps/web/lib/services/conversations.ts`, `apps/web/app/api/conversations/route.ts`, `apps/web/app/api/conversations/[id]/route.ts`, `apps/web/app/(app)/layout.tsx`, `apps/web/components/sidebar/sidebar.tsx`, `apps/web/components/sidebar/conversation-list.tsx`
- Test: `apps/web/lib/services/conversations.test.ts`

**Interfaces:**
- Produces:
  - `createConversation(db, { userId, assistantId?, model? }): Promise<ConversationRow>`
  - `listConversations(db, userId)` — ordenadas por `updatedAt` desc
  - `getConversation(db, id, userId): Promise<{ conversation, messages } | null>` — null se não for do usuário
  - `deleteConversation(db, id, userId)`
  - `replaceMessages(db, conversationId, uiMessages: {id?, role, parts}[])` — transação delete+insert, atualiza `updatedAt`
  - `setConversationTitle(db, id, title)`
  - APIs: `GET/POST /api/conversations`, `GET/DELETE /api/conversations/[id]` (sempre escopadas ao usuário da sessão)

- [ ] **Step 1: Teste que falha**

`apps/web/lib/services/conversations.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { createConversation, listConversations, getConversation, replaceMessages, deleteConversation } from "./conversations";
import { users } from "@/lib/db/schema";

async function makeUser(db: any, email = "u@g4.com") {
  const [u] = await db.insert(users).values({ name: "U", email, passwordHash: "x" }).returning();
  return u;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("conversations", () => {
  beforeEach(truncateAll);

  it("cria, lista e lê conversa com mensagens", async () => {
    const db = await getTestDb();
    const u = await makeUser(db);
    const conv = await createConversation(db, { userId: u.id });
    await replaceMessages(db, conv.id, [
      { role: "user", parts: [{ type: "text", text: "Oi" }] },
      { role: "assistant", parts: [{ type: "text", text: "Olá!" }] },
    ]);
    const got = await getConversation(db, conv.id, u.id);
    expect(got!.messages).toHaveLength(2);
    expect(await listConversations(db, u.id)).toHaveLength(1);
  });

  it("não expõe conversa de outro usuário", async () => {
    const db = await getTestDb();
    const dono = await makeUser(db, "dono@g4.com");
    const outro = await makeUser(db, "outro@g4.com");
    const conv = await createConversation(db, { userId: dono.id });
    expect(await getConversation(db, conv.id, outro.id)).toBeNull();
    await deleteConversation(db, conv.id, outro.id); // não deleta
    expect(await getConversation(db, conv.id, dono.id)).not.toBeNull();
  });

  it("replaceMessages é idempotente (substitui tudo)", async () => {
    const db = await getTestDb();
    const u = await makeUser(db);
    const conv = await createConversation(db, { userId: u.id });
    const msgs = [{ role: "user" as const, parts: [{ type: "text", text: "A" }] }];
    await replaceMessages(db, conv.id, msgs);
    await replaceMessages(db, conv.id, [...msgs, { role: "assistant" as const, parts: [{ type: "text", text: "B" }] }]);
    const got = await getConversation(db, conv.id, u.id);
    expect(got!.messages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/services/conversations` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/services/conversations.ts`:
```ts
import { and, asc, desc, eq } from "drizzle-orm";
import { conversations, messages } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function createConversation(db: Db, input: { userId: string; assistantId?: string | null; model?: string | null }) {
  const [row] = await db.insert(conversations).values({
    userId: input.userId, assistantId: input.assistantId ?? null, model: input.model ?? null,
  }).returning();
  return row;
}

export async function listConversations(db: Db, userId: string) {
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getConversation(db: Db, id: string, userId: string) {
  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!conv) return null;
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return { conversation: conv, messages: msgs };
}

export async function deleteConversation(db: Db, id: string, userId: string) {
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

type UiMsg = { role: "user" | "assistant"; parts: unknown };

export async function replaceMessages(db: Db, conversationId: string, uiMessages: UiMsg[]) {
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.conversationId, conversationId));
    if (uiMessages.length > 0) {
      // createdAt escalonado preserva a ordem na releitura
      const base = Date.now();
      await tx.insert(messages).values(uiMessages.map((m, i) => ({
        conversationId, role: m.role, parts: m.parts, createdAt: new Date(base + i),
      })));
    }
    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  });
}

export async function setConversationTitle(db: Db, id: string, title: string) {
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}
```
Nota: mensagens com role `system`/`tool` não são persistidas — apenas `user` e `assistant` (filtrar antes de chamar `replaceMessages`).

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/services/conversations` → PASS.

- [ ] **Step 5: Rotas API**

`apps/web/app/api/conversations/route.ts`:
```ts
import { db } from "@/lib/db";
import { createConversation, listConversations } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listConversations(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { assistantId, model } = await req.json().catch(() => ({}));
  const conv = await createConversation(db, { userId: session.user.id, assistantId, model });
  return Response.json(conv, { status: 201 });
});
```

`apps/web/app/api/conversations/[id]/route.ts`:
```ts
import { db } from "@/lib/db";
import { getConversation, deleteConversation } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const got = await getConversation(db, id, session.user.id);
  if (!got) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  return Response.json(got);
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  await deleteConversation(db, id, session.user.id);
  return new Response(null, { status: 204 });
});
```

- [ ] **Step 6: Layout autenticado + sidebar**

`apps/web/app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSetupCompleted } from "@/lib/services/setup";
import { listConversations } from "@/lib/services/conversations";
import { Sidebar } from "@/components/sidebar/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupCompleted(db))) redirect("/setup");
  const session = await auth();
  if (!session?.user) redirect("/login");
  const convs = await listConversations(db, session.user.id);
  return (
    <div className="flex h-screen">
      <Sidebar user={session.user} conversations={convs} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

`apps/web/components/sidebar/sidebar.tsx` — server-safe wrapper (recebe props): coluna fixa `w-64 border-r bg-card` com: `<Logo className="h-6 w-auto" />` no topo, botão dourado "Nova conversa" (`Link href="/"`), `<ConversationList conversations={...} />`, rodapé com nome do usuário, link "Administração" (`/admin/usuarios`, apenas `user.role === "admin"`) e botão "Sair".

`apps/web/components/sidebar/conversation-list.tsx` — client: `<Input placeholder="Buscar conversas..." />` no topo filtrando a lista por título no cliente (case-insensitive); lista de links `/c/[id]` (título ou "Nova conversa", truncado), item ativo destacado por `usePathname()`, ícone de lixeira em hover → DELETE `/api/conversations/[id]` + `router.refresh()` (se a ativa foi apagada, `router.push("/")`). Botão "Sair" usa `signOut()` de `next-auth/react`.

- [ ] **Step 7: Build + commit**

```bash
npm run build && git add -A && git commit -m "feat: conversas com API escopada ao usuário e layout com sidebar"
```

### Task 10: Upload e serving de arquivos

**Files:**
- Create: `apps/web/lib/files/storage.ts`, `apps/web/app/api/upload/route.ts`, `apps/web/app/api/files/[name]/route.ts`
- Test: `apps/web/lib/files/storage.test.ts`

**Interfaces:**
- Produces:
  - `CHAT_MIMES = ["image/png","image/jpeg","image/webp","application/pdf"]`, `KB_MIMES = ["application/pdf","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"]`, `MAX_UPLOAD_BYTES = 20 * 1024 * 1024`
  - `saveUpload(buf: Buffer, originalName: string, mime: string, allowed: string[]): Promise<{ storedName: string }>` — nome `\
${randomUUID()}__\
${nomeSanitizado}`; valida mime e tamanho
  - `readUpload(storedName): Promise<{ buf: Buffer; mime: string }>` — rejeita path traversal; mime inferido da extensão
  - `uploadsDir()` — `path.join(process.env.DATA_DIR ?? "/data", "uploads")`, cria com `mkdir -p`
  - API: `POST /api/upload` (multipart, campo `file`) → `{ url: "/api/files/<storedName>", mediaType, filename }`; `GET /api/files/[name]` autenticado.

- [ ] **Step 1: Teste que falha**

`apps/web/lib/files/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { saveUpload, readUpload, CHAT_MIMES, MAX_UPLOAD_BYTES } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "g4-test-"));
  });

  it("salva e lê arquivo com nome sanitizado", async () => {
    const { storedName } = await saveUpload(Buffer.from("dados"), "Relatório Final.pdf", "application/pdf", CHAT_MIMES);
    expect(storedName).toMatch(/^[0-9a-f-]{36}__relatorio-final\.pdf$/);
    const { buf, mime } = await readUpload(storedName);
    expect(buf.toString()).toBe("dados");
    expect(mime).toBe("application/pdf");
  });

  it("rejeita mime não permitido", async () => {
    await expect(saveUpload(Buffer.from("x"), "a.exe", "application/x-msdownload", CHAT_MIMES))
      .rejects.toThrow(/não permitido/i);
  });

  it("rejeita arquivo acima do limite", async () => {
    const grande = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(saveUpload(grande, "a.pdf", "application/pdf", CHAT_MIMES)).rejects.toThrow(/20 ?MB/i);
  });

  it("rejeita path traversal na leitura", async () => {
    await expect(readUpload("../../etc/passwd")).rejects.toThrow(/inválido/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/files` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/files/storage.ts`:
```ts
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const CHAT_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const KB_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const EXT_MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

export function uploadsDir() {
  return path.join(process.env.DATA_DIR ?? "/data", "uploads");
}

function sanitize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function saveUpload(buf: Buffer, originalName: string, mime: string, allowed: string[]) {
  if (!allowed.includes(mime)) throw new Error(`Tipo de arquivo não permitido: ${mime}`);
  if (buf.byteLength > MAX_UPLOAD_BYTES) throw new Error("Arquivo excede o limite de 20 MB");
  const storedName = `${randomUUID()}__${sanitize(originalName)}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), storedName), buf);
  return { storedName };
}

export async function readUpload(storedName: string) {
  if (storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) {
    throw new Error("Nome de arquivo inválido");
  }
  const mime = EXT_MIME[path.extname(storedName)] ?? "application/octet-stream";
  const buf = await readFile(path.join(uploadsDir(), storedName));
  return { buf, mime };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/files` → PASS.

- [ ] **Step 5: Rotas**

`apps/web/app/api/upload/route.ts`:
```ts
import { saveUpload, CHAT_MIMES } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const POST = apiHandler(async (req) => {
  await requireSession();
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const { storedName } = await saveUpload(buf, file.name, file.type, CHAT_MIMES);
  return Response.json({ url: `/api/files/${storedName}`, mediaType: file.type, filename: file.name });
});
```

`apps/web/app/api/files/[name]/route.ts`:
```ts
import { readUpload } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (_req, { params }) => {
  await requireSession();
  const { name } = await params;
  const { buf, mime } = await readUpload(name);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
  });
});
```

- [ ] **Step 6: Build + commit** — `npm run build && git add -A && git commit -m "feat: upload de anexos com validação e serving autenticado"`

### Task 11: Rota de chat com streaming

**Files:**
- Create: `apps/web/lib/ai/provider.ts`, `apps/web/lib/ai/system-prompt.ts`, `apps/web/lib/ai/prepare-messages.ts`, `apps/web/app/api/chat/route.ts`
- Test: `apps/web/lib/ai/prepare-messages.test.ts`

**Interfaces:**
- Consumes: `getOpenAIKey`, `getSettings`, `getConversation/replaceMessages`, `readUpload`.
- Produces:
  - `getProvider(db): Promise<ReturnType<typeof createOpenAI>>` — `createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL })`
  - `DEFAULT_SYSTEM_PROMPT: string` (persona G4 em pt-BR)
  - `prepareModelMessages(uiMessages, deps?): Promise<ModelMessage[]>` — resolve file parts locais (imagem→data URL, PDF→texto extraído) e converte via `convertToModelMessages`
  - `POST /api/chat` body `{ messages: UIMessage[], conversationId: string }` → stream UI message (SSE)

- [ ] **Step 1: Instalar deps** — `cd apps/web && npm i ai @ai-sdk/openai @ai-sdk/react zod unpdf`

- [ ] **Step 2: Teste que falha**

`apps/web/lib/ai/prepare-messages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prepareModelMessages } from "./prepare-messages";

const deps = {
  readFile: async (name: string) => ({
    buf: Buffer.from(name.includes("img") ? "PNGDATA" : "PDFDATA"),
    mime: name.includes("img") ? "image/png" : "application/pdf",
  }),
  extractPdfText: async () => "Texto extraído do PDF",
};

describe("prepareModelMessages", () => {
  it("mensagens de texto passam direto", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [{ type: "text", text: "Olá" }] },
    ] as any, deps);
    expect(out).toEqual([{ role: "user", content: [{ type: "text", text: "Olá" }] }]);
  });

  it("imagem local vira data URL", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "text", text: "veja" },
        { type: "file", url: "/api/files/abc__img.png", mediaType: "image/png", filename: "img.png" },
      ]},
    ] as any, deps);
    const filePart = (out[0].content as any[]).find((p) => p.type === "file");
    expect(filePart.data).toContain(`data:image/png;base64,${Buffer.from("PNGDATA").toString("base64")}`);
  });

  it("PDF local vira texto no contexto", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "file", url: "/api/files/abc__doc.pdf", mediaType: "application/pdf", filename: "doc.pdf" },
        { type: "text", text: "resuma" },
      ]},
    ] as any, deps);
    const texts = (out[0].content as any[]).filter((p) => p.type === "text").map((p) => p.text).join("\n");
    expect(texts).toContain("doc.pdf");
    expect(texts).toContain("Texto extraído do PDF");
    expect((out[0].content as any[]).some((p) => p.type === "file")).toBe(false);
  });

  it("descarta file parts com URL externa", async () => {
    const out = await prepareModelMessages([
      { id: "1", role: "user", parts: [
        { type: "file", url: "https://evil.com/x.png", mediaType: "image/png", filename: "x.png" },
        { type: "text", text: "oi" },
      ]},
    ] as any, deps);
    expect((out[0].content as any[]).every((p) => p.type === "text")).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run lib/ai/prepare-messages` → FAIL.

- [ ] **Step 4: Implementar**

`apps/web/lib/ai/prepare-messages.ts`:
```ts
import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { readUpload } from "@/lib/files/storage";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_PDF_CHARS = 60_000; // ~15k tokens; acima disso trunca com aviso

async function defaultExtractPdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

type Deps = {
  readFile: (storedName: string) => Promise<{ buf: Buffer; mime: string }>;
  extractPdfText: (buf: Buffer) => Promise<string>;
};

const defaultDeps: Deps = {
  readFile: readUpload,
  extractPdfText: defaultExtractPdfText,
};

export async function prepareModelMessages(uiMessages: UIMessage[], deps: Deps = defaultDeps): Promise<ModelMessage[]> {
  const transformed = [] as UIMessage[];
  for (const msg of uiMessages) {
    const parts: any[] = [];
    for (const part of msg.parts as any[]) {
      if (part.type !== "file") { parts.push(part); continue; }
      if (!part.url?.startsWith("/api/files/")) continue; // descarta URLs externas
      const storedName = part.url.slice("/api/files/".length);
      const { buf, mime } = await deps.readFile(storedName);
      if (mime === "application/pdf") {
        let text = await deps.extractPdfText(buf);
        if (text.length > MAX_PDF_CHARS) {
          text = text.slice(0, MAX_PDF_CHARS) + "\n[Documento truncado por tamanho]";
        }
        parts.push({ type: "text", text: `Conteúdo do arquivo "${part.filename}":\n\n${text}` });
      } else if (mime.startsWith("image/")) {
        parts.push({ ...part, url: `data:${mime};base64,${buf.toString("base64")}` });
      }
    }
    transformed.push({ ...msg, parts });
  }
  return convertToModelMessages(transformed);
}
```
Nota: `convertToModelMessages` (AI SDK v5) transforma file parts com data URL em `{ type: "file", data, mediaType }` — o teste do Step 2 deve ser ajustado ao formato real observado na primeira execução (asserção sobre `data` vs `url` pode variar entre minors do SDK; fixar no que o SDK atual emitir).

`apps/web/lib/ai/provider.ts`:
```ts
import { createOpenAI } from "@ai-sdk/openai";
import { getOpenAIKey } from "@/lib/services/settings";
import type { Db } from "@/lib/db";

export async function getProvider(db: Db) {
  const apiKey = await getOpenAIKey(db);
  return createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL });
}
```

`apps/web/lib/ai/system-prompt.ts`:
```ts
export const DEFAULT_SYSTEM_PROMPT = `Você é o G4 IA Assistente, o assistente de inteligência artificial do G4 — a escola de negócios para quem quer mais.
Ajude com gestão, estratégia, vendas, marketing e operações com a objetividade de quem vive negócios no Brasil.
Responda sempre em português do Brasil, de forma direta e prática, usando markdown quando ajudar na clareza.`;
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run lib/ai` → PASS.

- [ ] **Step 6: Rota /api/chat**

`apps/web/app/api/chat/route.ts`:
```ts
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getConversation, replaceMessages, setConversationTitle } from "@/lib/services/conversations";
import { getSettings } from "@/lib/services/settings";
import { getProvider } from "@/lib/ai/provider";
import { prepareModelMessages } from "@/lib/ai/prepare-messages";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { generateConversationTitle } from "@/lib/ai/title";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { messages: uiMessages, conversationId } = await req.json();

  const got = await getConversation(db, conversationId, session.user.id);
  if (!got) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });

  const settings = await getSettings(db);
  const openai = await getProvider(db);
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  const modelId = got.conversation.model ?? assistant?.model ?? settings.defaultModel;

  const result = streamText({
    // .chat() força a API de chat completions (necessário para o mock do e2e da Parte 2)
    model: openai.chat(modelId),
    system: assistant?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    messages: await prepareModelMessages(uiMessages),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    onFinish: async ({ messages: finalMessages }) => {
      const persistable = finalMessages
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({ role: m.role, parts: m.parts }));
      await replaceMessages(db, conversationId, persistable);
      if (!got.conversation.title) {
        const firstText = (uiMessages[0]?.parts ?? []).find((p: any) => p.type === "text")?.text ?? "Nova conversa";
        const title = await generateConversationTitle(openai.chat(settings.defaultModel), firstText).catch(() => null);
        if (title) await setConversationTitle(db, conversationId, title);
      }
    },
  });
});
```
Nota: `generateConversationTitle` é implementada na Task 13 — para esta task compilar, criar `apps/web/lib/ai/title.ts` com stub temporário que retorna `null`... **não**: para evitar stub, implementar Task 13 ANTES de fechar esta task se preferir; alternativa aceita: nesta task, omitir o bloco `if (!got.conversation.title)` e adicioná-lo na Task 13. **Escolher a alternativa: o bloco de título entra na Task 13.** O código acima sem o bloco de título é o entregável desta task.

- [ ] **Step 7: Build + commit** — `npm run build && git add -A && git commit -m "feat: rota de chat com streaming, visão e PDFs no contexto"`

### Task 12: UI do chat

**Files:**
- Create: `apps/web/components/chat/chat.tsx`, `apps/web/components/chat/message-list.tsx`, `apps/web/components/chat/markdown.tsx`, `apps/web/components/chat/message-input.tsx`, `apps/web/components/chat/model-picker.tsx`, `apps/web/components/chat/assistant-picker.tsx`, `apps/web/app/(app)/page.tsx` (substituir placeholder em `app/page.tsx` — mover para grupo `(app)`), `apps/web/app/(app)/c/[id]/page.tsx`
- Delete: `apps/web/app/page.tsx` (placeholder da Task 2)

**Interfaces:**
- Consumes: `POST /api/conversations`, `POST /api/upload`, `/api/chat`, `getConversation`.
- Produces: `<Chat conversationId initialMessages assistantName? />` client component completo.

- [ ] **Step 1: Instalar deps** — `cd apps/web && npm i react-markdown remark-gfm`

- [ ] **Step 2: Markdown renderer**

`apps/web/components/chat/markdown.tsx`:
```tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <div className="group relative">
      <button
        className="absolute right-2 top-2 hidden rounded bg-secondary px-2 py-1 text-xs group-hover:block"
        onClick={(e) => {
          const code = (e.currentTarget.nextElementSibling as HTMLElement)?.innerText ?? "";
          navigator.clipboard.writeText(code);
          toast("Código copiado");
        }}
      >Copiar</button>
      <pre {...props} className="overflow-x-auto rounded-lg bg-[#04101a] p-4 text-sm">{children}</pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre }}>{children}</ReactMarkdown>
    </div>
  );
}
```
Instalar plugin de tipografia: `npm i -D @tailwindcss/typography` e adicionar `@plugin "@tailwindcss/typography";` no `globals.css`.

- [ ] **Step 3: Componente Chat (useChat v5)**

`apps/web/components/chat/chat.tsx`:
```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageList } from "./message-list";
import { MessageInput, type Attachment } from "./message-input";

export function Chat({ conversationId, initialMessages, assistantName }: {
  conversationId: string;
  initialMessages: any[];
  assistantName?: string | null;
}) {
  const router = useRouter();
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { conversationId } }),
    messages: initialMessages,
  });
  const enviouPendente = useRef(false);

  // primeira mensagem vinda da página "nova conversa"
  useEffect(() => {
    const pendente = sessionStorage.getItem(`draft:${conversationId}`);
    if (pendente && !enviouPendente.current) {
      enviouPendente.current = true;
      sessionStorage.removeItem(`draft:${conversationId}`);
      const { text, files } = JSON.parse(pendente);
      sendMessage({ text, files });
    }
  }, [conversationId, sendMessage]);

  // atualiza sidebar (título) quando terminar a primeira resposta
  useEffect(() => {
    if (status === "ready" && messages.length === 2) router.refresh();
  }, [status, messages.length, router]);

  function onSend(text: string, files: Attachment[]) {
    sendMessage({ text, files: files.length ? files : undefined });
  }

  return (
    <div className="flex h-full flex-col">
      {assistantName && (
        <div className="border-b px-4 py-2 text-sm text-muted-foreground">
          Assistente: <span className="text-primary">{assistantName}</span>
        </div>
      )}
      <MessageList messages={messages} streaming={status === "streaming"} />
      <MessageInput onSend={onSend} disabled={status !== "ready" && status !== "error"} />
    </div>
  );
}
```

- [ ] **Step 4: MessageList e MessageInput**

`apps/web/components/chat/message-list.tsx` — client: scroll automático para o fim (`useEffect` + ref), cada mensagem:
- `user`: balão alinhado à direita `bg-secondary rounded-2xl px-4 py-2 max-w-[80%]`; renderiza parts `text` como texto puro e parts `file` de imagem como `<img src={part.url} className="max-h-48 rounded-lg" />`, PDF como chip com nome.
- `assistant`: sem balão, largura total com `<Markdown>{textoConcatenadoDasParts}</Markdown>`; ignora parts que não sejam `text` (tool calls aparecem na Task 18 como chip "Consultando base de conhecimento…" quando `part.type === "tool-buscarConhecimento"`).
- Indicador "digitando": três pontos animados quando `streaming` e última mensagem não é assistant com texto.

`apps/web/components/chat/message-input.tsx`:
```tsx
"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type Attachment = { type: "file"; url: string; mediaType: string; filename: string };

export function MessageInput({ onSend, disabled }: { onSend: (text: string, files: Attachment[]) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) { toast.error((await res.json()).error ?? "Falha no upload"); return; }
    const meta = await res.json();
    setFiles((f) => [...f, { type: "file", url: meta.url, mediaType: meta.mediaType, filename: meta.filename }]);
    e.target.value = "";
  }

  function submit() {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files);
    setText(""); setFiles([]);
  }

  return (
    <div className="border-t p-4">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              {f.filename}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remover">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp,application/pdf" onChange={attach} />
        <Button variant="outline" size="icon" onClick={() => inputRef.current?.click()} aria-label="Anexar arquivo">+</Button>
        <Textarea
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Envie uma mensagem..." rows={1} className="max-h-40 min-h-[44px] resize-none"
        />
        <Button onClick={submit} disabled={disabled}>Enviar</Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">O G4 IA Assistente pode cometer erros. Confira informações importantes.</p>
    </div>
  );
}
```

- [ ] **Step 5: Páginas nova conversa e conversa**

`apps/web/app/(app)/page.tsx` — server: carrega assistentes ativos (`db.select().from(assistants).where(eq(assistants.active, true))`) e settings; renderiza client `NewChat` (inline no mesmo grupo em `components/chat/new-chat.tsx`): saudação central com `<Logo>` + frase serif itálica "Para quem quer mais", `<AssistantPicker>` (Select "Chat livre" + assistentes), `<ModelPicker>` (Select com SUPPORTED_MODELS, default do settings) e `<MessageInput>`; ao enviar: `POST /api/conversations` `{ assistantId, model }` → grava `sessionStorage.setItem("draft:"+id, JSON.stringify({ text, files }))` → `router.push("/c/"+id)`.

`apps/web/app/(app)/c/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConversation } from "@/lib/services/conversations";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Chat } from "@/components/chat/chat";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await auth())!;
  const got = await getConversation(db, id, session.user.id);
  if (!got) notFound();
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  const initialMessages = got.messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts }));
  return <Chat conversationId={id} initialMessages={initialMessages} assistantName={assistant?.name} />;
}
```

- [ ] **Step 6: Verificação manual**

`npm run dev` → login → enviar mensagem (com chave OpenAI real ou mock) → streaming aparece, anexar imagem funciona, conversa persiste após F5, sidebar lista a conversa.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: interface de chat com streaming, anexos e markdown"`

### Task 13: Título automático de conversas

**Files:**
- Create: `apps/web/lib/ai/title.ts`
- Modify: `apps/web/app/api/chat/route.ts` (adicionar bloco de título no onFinish — código exato já mostrado na Task 11 Step 6)
- Test: `apps/web/lib/ai/title.test.ts`

**Interfaces:**
- Produces: `generateConversationTitle(model: LanguageModel, firstUserText: string): Promise<string>` — máx 60 chars, sem aspas/quebras.

- [ ] **Step 1: Teste que falha**

`apps/web/lib/ai/title.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { generateConversationTitle } from "./title";

function mockModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
}

describe("generateConversationTitle", () => {
  it("retorna título limpo", async () => {
    const t = await generateConversationTitle(mockModel('"Plano de vendas Q3"\n') as any, "me ajude com vendas");
    expect(t).toBe("Plano de vendas Q3");
  });

  it("trunca títulos longos em 60 chars", async () => {
    const t = await generateConversationTitle(mockModel("x".repeat(200)) as any, "oi");
    expect(t.length).toBeLessThanOrEqual(60);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/ai/title` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/ai/title.ts`:
```ts
import { generateText, type LanguageModel } from "ai";

export async function generateConversationTitle(model: LanguageModel, firstUserText: string): Promise<string> {
  const { text } = await generateText({
    model,
    prompt: `Crie um título curto (máx. 6 palavras, sem aspas) em português para uma conversa que começa com: "${firstUserText.slice(0, 500)}"`,
  });
  return text.replaceAll('"', "").replaceAll("\n", " ").trim().slice(0, 60);
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/ai/title` → PASS.

- [ ] **Step 5: Ligar no onFinish do /api/chat** — adicionar o bloco `if (!got.conversation.title) {...}` exatamente como mostrado na Task 11 Step 6, incluindo o import de `generateConversationTitle` e `setConversationTitle`.

- [ ] **Step 6: Build + commit** — `npm run build && git add -A && git commit -m "feat: título automático de conversas"`

---

## Fase 3 — RAG (assistentes com base de conhecimento)

### Task 14: CRUD de assistentes + configurações admin

**Files:**
- Create: `apps/web/lib/services/assistants.ts`, `apps/web/app/api/assistants/route.ts`, `apps/web/app/api/assistants/[id]/route.ts`, `apps/web/app/api/settings/route.ts`, `apps/web/app/(app)/admin/layout.tsx`, `apps/web/app/(app)/admin/assistentes/page.tsx`, `apps/web/app/(app)/admin/assistentes/[id]/page.tsx`, `apps/web/app/(app)/admin/configuracoes/page.tsx`, `apps/web/components/admin/assistant-form.tsx`, `apps/web/components/admin/settings-form.tsx`
- Test: `apps/web/lib/services/assistants.test.ts`

**Interfaces:**
- Produces:
  - `createAssistant(db, { name, systemPrompt, description?, model?, createdBy })` — valida nome e systemPrompt não-vazios
  - `updateAssistant(db, id, patch)`, `listAssistants(db, { onlyActive? })`, `getAssistant(db, id)`, `deleteAssistant(db, id)` (delete real; arquivos/chunks caem por cascade)
  - APIs: `GET /api/assistants` (sessão; `?active=1` para o picker), `POST /api/assistants` (admin), `GET/PATCH/DELETE /api/assistants/[id]` (admin)
  - `GET /api/settings` (admin) → `{ defaultModel, hasKey }`; `PATCH /api/settings` (admin) `{ openaiKey?, defaultModel? }` — chave revalidada com `validateOpenAIKey` antes de salvar
  - `apps/web/app/(app)/admin/layout.tsx` — guarda: `session.user.role !== "admin"` → `redirect("/")`; nav com abas Usuários / Assistentes / Configurações.

- [ ] **Step 1: Teste que falha**

`apps/web/lib/services/assistants.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { createAssistant, updateAssistant, listAssistants, deleteAssistant } from "./assistants";
import { users } from "@/lib/db/schema";

describe.skipIf(!process.env.TEST_DATABASE_URL)("assistants", () => {
  beforeEach(truncateAll);

  async function admin(db: any) {
    const [u] = await db.insert(users).values({ name: "A", email: "a@g4.com", passwordHash: "x", role: "admin" }).returning();
    return u;
  }

  it("cria, atualiza, lista e remove", async () => {
    const db = await getTestDb();
    const u = await admin(db);
    const a = await createAssistant(db, { name: "Vendas", systemPrompt: "Você é especialista em vendas.", createdBy: u.id });
    expect(a.active).toBe(true);
    await updateAssistant(db, a.id, { active: false, description: "desc" });
    expect(await listAssistants(db, { onlyActive: true })).toHaveLength(0);
    expect(await listAssistants(db, {})).toHaveLength(1);
    await deleteAssistant(db, a.id);
    expect(await listAssistants(db, {})).toHaveLength(0);
  });

  it("valida campos obrigatórios", async () => {
    const db = await getTestDb();
    const u = await admin(db);
    await expect(createAssistant(db, { name: " ", systemPrompt: "x", createdBy: u.id })).rejects.toThrow(/nome/i);
    await expect(createAssistant(db, { name: "X", systemPrompt: "", createdBy: u.id })).rejects.toThrow(/prompt/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/services/assistants` → FAIL.

- [ ] **Step 3: Implementar serviço**

`apps/web/lib/services/assistants.ts`:
```ts
import { eq } from "drizzle-orm";
import { assistants } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

type CreateInput = { name: string; systemPrompt: string; description?: string; model?: string | null; createdBy: string };

export async function createAssistant(db: Db, input: CreateInput) {
  if (!input.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (!input.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  const [row] = await db.insert(assistants).values({
    name: input.name.trim(), systemPrompt: input.systemPrompt,
    description: input.description ?? null, model: input.model ?? null, createdBy: input.createdBy,
  }).returning();
  return row;
}

export async function updateAssistant(db: Db, id: string, patch: Partial<CreateInput & { active: boolean }>) {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (patch.systemPrompt !== undefined && !patch.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  await db.update(assistants).set(patch).where(eq(assistants.id, id));
}

export async function listAssistants(db: Db, opts: { onlyActive?: boolean }) {
  const q = db.select().from(assistants);
  return opts.onlyActive ? q.where(eq(assistants.active, true)) : q;
}

export async function getAssistant(db: Db, id: string) {
  return (await db.select().from(assistants).where(eq(assistants.id, id)))[0] ?? null;
}

export async function deleteAssistant(db: Db, id: string) {
  await db.delete(assistants).where(eq(assistants.id, id));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/services/assistants` → PASS.

- [ ] **Step 5: Rotas API**

`apps/web/app/api/assistants/route.ts`:
```ts
import { db } from "@/lib/db";
import { createAssistant, listAssistants } from "@/lib/services/assistants";
import { apiHandler, requireAdmin, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (req) => {
  await requireSession();
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  return Response.json(await listAssistants(db, { onlyActive }));
});

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const { name, systemPrompt, description, model } = await req.json();
  const row = await createAssistant(db, { name, systemPrompt, description, model, createdBy: session.user.id });
  return Response.json(row, { status: 201 });
});
```

`apps/web/app/api/assistants/[id]/route.ts`:
```ts
import { db } from "@/lib/db";
import { getAssistant, updateAssistant, deleteAssistant } from "@/lib/services/assistants";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const row = await getAssistant(db, id);
  if (!row) return Response.json({ error: "Assistente não encontrado" }, { status: 404 });
  return Response.json(row);
});

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await updateAssistant(db, id, await req.json());
  return new Response(null, { status: 204 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteAssistant(db, id);
  return new Response(null, { status: 204 });
});
```

`apps/web/app/api/settings/route.ts`:
```ts
import { db } from "@/lib/db";
import { getSettings, saveOpenAIKey, setDefaultModel } from "@/lib/services/settings";
import { validateOpenAIKey } from "@/lib/services/setup";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const s = await getSettings(db);
  return Response.json({ defaultModel: s.defaultModel, hasKey: s.hasKey });
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const { openaiKey, defaultModel } = await req.json();
  if (openaiKey) {
    if (!(await validateOpenAIKey(openaiKey))) return Response.json({ error: "Chave OpenAI inválida" }, { status: 400 });
    await saveOpenAIKey(db, openaiKey);
  }
  if (defaultModel) await setDefaultModel(db, defaultModel);
  return new Response(null, { status: 204 });
});
```

- [ ] **Step 6: Páginas admin**

- `admin/layout.tsx`: guarda de role + `<nav>` com links (Usuários, Assistentes, Configurações) estilo abas (`border-b`, ativo em dourado).
- `admin/assistentes/page.tsx`: server — `listAssistants(db, {})`, grid de Cards (nome, descrição, badge ativo/inativo, contagem de arquivos) + botão "Novo assistente" → Dialog com `<AssistantForm />`.
- `components/admin/assistant-form.tsx`: client — campos nome, descrição, system prompt (Textarea alta), modelo (Select "Padrão do sistema" + SUPPORTED_MODELS); POST/PATCH conforme `assistant?` prop; toast + `router.refresh()`.
- `admin/assistentes/[id]/page.tsx`: server — `getAssistant` + `<AssistantForm assistant={...} />` + seção "Base de conhecimento" com `<AssistantFiles assistantId={...} />` (componente criado na Task 17; nesta task renderizar placeholder `<p>Base de conhecimento disponível em breve.</p>` e trocar na Task 17).
- `admin/configuracoes/page.tsx` + `components/admin/settings-form.tsx`: client — campo "Nova chave OpenAI" (password, placeholder "sk-... (deixe em branco para manter)"), Select modelo padrão; PATCH `/api/settings`; toasts de sucesso/erro.

- [ ] **Step 7: Build + commit** — `npm run build && git add -A && git commit -m "feat: CRUD de assistentes e configurações no admin"`

### Task 15: Extração de texto (PDF e Excel)

**Files:**
- Create: `apps/web/lib/rag/extract.ts`, `apps/web/test/fixtures/make-fixtures.mjs`, `apps/web/test/fixtures/exemplo.pdf`, `apps/web/test/fixtures/exemplo.xlsx`
- Test: `apps/web/lib/rag/extract.test.ts`

**Interfaces:**
- Produces: `extractTextFromFile(buf: Buffer, mime: string): Promise<string>` — PDF via unpdf; Excel via SheetJS (todas as abas, formato `### Aba: <nome>` + CSV); mime desconhecido lança.

- [ ] **Step 1: Instalar deps e gerar fixtures**

```bash
cd apps/web && npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz && npm i -D pdf-lib
```

`apps/web/test/fixtures/make-fixtures.mjs`:
```js
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";

const pdf = await PDFDocument.create();
const page = pdf.addPage();
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("O faturamento do G4 em 2025 foi de 10 milhoes de reais.", { x: 50, y: 700, size: 14, font });
writeFileSync(new URL("./exemplo.pdf", import.meta.url), await pdf.save());

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([["Produto", "Receita"], ["Imersao", 5000000], ["Club", 3000000]]);
XLSX.utils.book_append_sheet(wb, ws, "Vendas");
XLSX.writeFile(wb, new URL("./exemplo.xlsx", import.meta.url).pathname);
console.log("fixtures geradas");
```
Rodar: `node test/fixtures/make-fixtures.mjs` e commitar os binários gerados.

- [ ] **Step 2: Teste que falha**

`apps/web/lib/rag/extract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractTextFromFile } from "./extract";

const fixture = (n: string) => readFileSync(path.join(__dirname, "../../test/fixtures", n));

describe("extractTextFromFile", () => {
  it("extrai texto de PDF", async () => {
    const text = await extractTextFromFile(fixture("exemplo.pdf"), "application/pdf");
    expect(text).toContain("faturamento do G4");
  });

  it("extrai todas as abas de Excel como CSV", async () => {
    const text = await extractTextFromFile(
      fixture("exemplo.xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(text).toContain("### Aba: Vendas");
    expect(text).toContain("Produto,Receita");
    expect(text).toContain("Imersao,5000000");
  });

  it("lança para mime desconhecido", async () => {
    await expect(extractTextFromFile(Buffer.from("x"), "text/plain")).rejects.toThrow(/não suportado/i);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run lib/rag/extract` → FAIL.

- [ ] **Step 4: Implementar**

`apps/web/lib/rag/extract.ts`:
```ts
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

const EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export async function extractTextFromFile(buf: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (EXCEL_MIMES.includes(mime)) {
    const wb = XLSX.read(buf, { type: "buffer" });
    return wb.SheetNames.map((name) =>
      `### Aba: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`
    ).join("\n\n");
  }
  throw new Error(`Tipo de arquivo não suportado para extração: ${mime}`);
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run lib/rag/extract` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: extração de texto de PDF e Excel com fixtures de teste"`

### Task 16: Chunking

**Files:**
- Create: `apps/web/lib/rag/chunking.ts`
- Test: `apps/web/lib/rag/chunking.test.ts`

**Interfaces:**
- Produces: `chunkText(text: string, opts?: { maxChars?: number; overlap?: number }): string[]` — defaults `maxChars=1800`, `overlap=200`.

- [ ] **Step 1: Teste que falha**

`apps/web/lib/rag/chunking.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { chunkText } from "./chunking";

describe("chunkText", () => {
  it("texto vazio/espacos → []", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("texto curto → um chunk único, trimado", () => {
    expect(chunkText("  Olá mundo.  ")).toEqual(["Olá mundo."]);
  });

  it("nenhum chunk excede maxChars", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Parágrafo ${i} com algum conteúdo relevante sobre negócios.`).join("\n\n");
    const chunks = chunkText(text, { maxChars: 200, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
  });

  it("chunks consecutivos compartilham overlap", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Frase número ${i} sobre estratégia.`).join(" ");
    const chunks = chunkText(text, { maxChars: 150, overlap: 40 });
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].slice(-40);
      expect(chunks[i].startsWith(tail.slice(tail.indexOf(" ") + 1).trim().split(" ")[0])).toBe(true);
    }
  });

  it("parágrafo único maior que maxChars é dividido", () => {
    const text = "palavra ".repeat(500);
    const chunks = chunkText(text, { maxChars: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/rag/chunking` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/rag/chunking.ts`:
```ts
type Opts = { maxChars?: number; overlap?: number };

export function chunkText(text: string, opts: Opts = {}): string[] {
  const maxChars = opts.maxChars ?? 1800;
  const overlap = opts.overlap ?? 200;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // quebra em unidades: parágrafos; parágrafos grandes viram frases; frases grandes viram fatias duras
  const units: string[] = [];
  for (const para of normalized.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= maxChars) { units.push(p); continue; }
    for (const sentence of p.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= maxChars) units.push(sentence);
      else for (let i = 0; i < sentence.length; i += maxChars) units.push(sentence.slice(i, i + maxChars));
    }
  }

  const chunks: string[] = [];
  let atual = "";
  for (const unit of units) {
    const candidato = atual ? `${atual}\n${unit}` : unit;
    if (candidato.length <= maxChars) { atual = candidato; continue; }
    if (atual) chunks.push(atual);
    // overlap: começa o próximo chunk com o final do anterior (sem cortar palavra)
    const tail = atual.slice(-overlap);
    const overlapText = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : tail;
    atual = overlapText ? `${overlapText.trim()}\n${unit}`.slice(-maxChars) : unit;
    if (atual.length > maxChars) atual = unit.slice(0, maxChars);
  }
  if (atual) chunks.push(atual);
  return chunks;
}
```
Ajustar a implementação se algum teste do Step 1 falhar por detalhe de borda — os testes são o contrato; a implementação pode ser refinada livremente.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/rag/chunking` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: chunking de texto com overlap para RAG"`

### Task 17: Pipeline de ingestão + upload da base de conhecimento

**Files:**
- Create: `apps/web/lib/rag/ingest.ts`, `apps/web/app/api/assistants/[id]/files/route.ts`, `apps/web/app/api/assistants/[id]/files/[fileId]/route.ts`, `apps/web/components/admin/assistant-files.tsx`
- Modify: `apps/web/app/(app)/admin/assistentes/[id]/page.tsx` (trocar placeholder por `<AssistantFiles>`)
- Test: `apps/web/lib/rag/ingest.test.ts`

**Interfaces:**
- Consumes: `extractTextFromFile`, `chunkText`, `saveUpload/readUpload` (`KB_MIMES`), `getProvider`.
- Produces:
  - `ingestFile(db, fileId, deps: { embed(texts: string[]): Promise<number[][]> }): Promise<void>` — transições de status pending→processing→ready|error
  - `startIngestion(db, fileId): void` — fire-and-forget com embedder real (`embedMany` + `openai.textEmbeddingModel("text-embedding-3-small")`), erros logados
  - APIs: `GET /api/assistants/[id]/files` (admin) → lista com status; `POST` (multipart) → cria registro + dispara ingestão, responde 202; `DELETE /api/assistants/[id]/files/[fileId]` → remove registro (chunks caem por cascade) e apaga arquivo do volume (best-effort).

- [ ] **Step 1: Teste que falha**

`apps/web/lib/rag/ingest.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { ingestFile } from "./ingest";
import { users, assistants, assistantFiles, chunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const fakeEmbed = async (texts: string[]) => texts.map((_, i) => {
  const v = new Array(1536).fill(0); v[i % 1536] = 1; return v;
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("ingestFile", () => {
  beforeEach(async () => {
    await truncateAll();
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "g4-ingest-"));
  });

  async function seed(db: any, storedName: string) {
    const [u] = await db.insert(users).values({ name: "A", email: "a@g4.com", passwordHash: "x", role: "admin" }).returning();
    const [a] = await db.insert(assistants).values({ name: "V", systemPrompt: "sp", createdBy: u.id }).returning();
    const [f] = await db.insert(assistantFiles).values({
      assistantId: a.id, filename: "exemplo.pdf", mime: "application/pdf",
      size: 100, storagePath: storedName,
    }).returning();
    return { a, f };
  }

  it("processa PDF: chunks com embeddings e status ready", async () => {
    const db = await getTestDb();
    // copia fixture para o DATA_DIR como se tivesse sido upload
    const fix = readFileSync(path.join(__dirname, "../../test/fixtures/exemplo.pdf"));
    const dir = path.join(process.env.DATA_DIR!, "uploads");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "aaa__exemplo.pdf"), fix);

    const { a, f } = await seed(db, "aaa__exemplo.pdf");
    await ingestFile(db, f.id, { embed: fakeEmbed });

    const [updated] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, f.id));
    expect(updated.status).toBe("ready");
    const rows = await db.select().from(chunks).where(eq(chunks.assistantId, a.id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].embedding).toHaveLength(1536);
  });

  it("marca error quando embedding falha", async () => {
    const db = await getTestDb();
    const fix = readFileSync(path.join(__dirname, "../../test/fixtures/exemplo.pdf"));
    const dir = path.join(process.env.DATA_DIR!, "uploads");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "bbb__exemplo.pdf"), fix);
    const { f } = await seed(db, "bbb__exemplo.pdf");

    await ingestFile(db, f.id, { embed: async () => { throw new Error("quota"); } });
    const [updated] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, f.id));
    expect(updated.status).toBe("error");
    expect(updated.error).toContain("quota");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/rag/ingest` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/rag/ingest.ts`:
```ts
import { eq } from "drizzle-orm";
import { embedMany } from "ai";
import { assistantFiles, chunks } from "@/lib/db/schema";
import { readUpload } from "@/lib/files/storage";
import { extractTextFromFile } from "./extract";
import { chunkText } from "./chunking";
import { getProvider } from "@/lib/ai/provider";
import type { Db } from "@/lib/db";

type Deps = { embed: (texts: string[]) => Promise<number[][]> };

export async function ingestFile(db: Db, fileId: string, deps: Deps) {
  const [file] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, fileId));
  if (!file) throw new Error("Arquivo não encontrado");
  await db.update(assistantFiles).set({ status: "processing", error: null }).where(eq(assistantFiles.id, fileId));
  try {
    const { buf } = await readUpload(file.storagePath);
    const text = await extractTextFromFile(buf, file.mime);
    const parts = chunkText(text);
    if (parts.length === 0) throw new Error("Nenhum texto extraído do arquivo");

    await db.delete(chunks).where(eq(chunks.fileId, fileId)); // reprocessamento idempotente
    for (let i = 0; i < parts.length; i += 100) {
      const lote = parts.slice(i, i + 100);
      const embeddings = await deps.embed(lote);
      await db.insert(chunks).values(lote.map((content, j) => ({
        fileId, assistantId: file.assistantId, content, chunkIndex: i + j, embedding: embeddings[j],
      })));
    }
    await db.update(assistantFiles).set({ status: "ready" }).where(eq(assistantFiles.id, fileId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(assistantFiles).set({ status: "error", error: msg }).where(eq(assistantFiles.id, fileId));
  }
}

export function startIngestion(db: Db, fileId: string) {
  const realEmbed = async (texts: string[]) => {
    const openai = await getProvider(db);
    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      values: texts,
    });
    return embeddings;
  };
  void ingestFile(db, fileId, { embed: realEmbed }).catch((e) => {
    console.error(`[ingestão] falha no arquivo ${fileId}:`, e);
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/rag/ingest` → PASS.

- [ ] **Step 5: Rotas de arquivos**

`apps/web/app/api/assistants/[id]/files/route.ts`:
```ts
import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { saveUpload, KB_MIMES } from "@/lib/files/storage";
import { startIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { desc, eq } from "drizzle-orm";

export const GET = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const rows = await db.select().from(assistantFiles)
    .where(eq(assistantFiles.assistantId, id)).orderBy(desc(assistantFiles.createdAt));
  return Response.json(rows);
});

export const POST = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const { storedName } = await saveUpload(buf, file.name, file.type, KB_MIMES);
  const [row] = await db.insert(assistantFiles).values({
    assistantId: id, filename: file.name, mime: file.type, size: buf.byteLength, storagePath: storedName,
  }).returning();
  startIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});
```

`apps/web/app/api/assistants/[id]/files/[fileId]/route.ts`:
```ts
import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { eq } from "drizzle-orm";

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { fileId } = await params;
  const [row] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, fileId));
  if (row) {
    await db.delete(assistantFiles).where(eq(assistantFiles.id, fileId));
    await unlink(path.join(uploadsDir(), row.storagePath)).catch(() => {});
  }
  return new Response(null, { status: 204 });
});
```

- [ ] **Step 6: UI da base de conhecimento**

`apps/web/components/admin/assistant-files.tsx` — client:
- Botão "Adicionar arquivo" (input file `accept=".pdf,.xlsx,.xls"`) → POST multipart → refetch.
- Tabela: nome, tamanho (KB/MB), Badge de status (`pending`/`processing` = "Processando…" âmbar com spinner; `ready` = "Pronto" verde; `error` = "Erro" vermelho com tooltip da mensagem), botão remover (DELETE + refetch).
- Polling: `useEffect` com `setInterval(3000)` enquanto houver arquivo `pending|processing`; limpa quando todos finalizarem.
- Substituir o placeholder na página `admin/assistentes/[id]/page.tsx` por `<AssistantFiles assistantId={assistant.id} />`.

- [ ] **Step 7: Build + commit** — `npm run build && git add -A && git commit -m "feat: ingestão de PDFs/Excel com embeddings no pgvector"`

### Task 18: Busca vetorial + tool buscarConhecimento no chat

**Files:**
- Create: `apps/web/lib/rag/search.ts`, `apps/web/lib/ai/knowledge-tool.ts`
- Modify: `apps/web/app/api/chat/route.ts` (ligar tool quando assistente tem arquivos ready), `apps/web/components/chat/message-list.tsx` (chip de tool call)
- Test: `apps/web/lib/rag/search.test.ts`

**Interfaces:**
- Produces:
  - `searchChunks(db, assistantId, embedding: number[], opts?: { k?: number; minSimilarity?: number }): Promise<{ content: string; filename: string; similarity: number }[]>` — defaults k=8, minSimilarity=0.25
  - `hasReadyFiles(db, assistantId): Promise<boolean>`
  - `makeKnowledgeTool(db, openai, assistantId)` — AI SDK `tool()` com `inputSchema: z.object({ consulta: z.string() })`

- [ ] **Step 1: Teste que falha**

`apps/web/lib/rag/search.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { searchChunks, hasReadyFiles } from "./search";
import { users, assistants, assistantFiles, chunks } from "@/lib/db/schema";

function vec(hotIndex: number): number[] {
  const v = new Array(1536).fill(0); v[hotIndex] = 1; return v;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("searchChunks", () => {
  beforeEach(truncateAll);

  async function seed(db: any) {
    const [u] = await db.insert(users).values({ name: "A", email: "a@g4.com", passwordHash: "x" }).returning();
    const [a] = await db.insert(assistants).values({ name: "V", systemPrompt: "sp", createdBy: u.id }).returning();
    const [f] = await db.insert(assistantFiles).values({
      assistantId: a.id, filename: "doc.pdf", mime: "application/pdf", size: 1, storagePath: "x", status: "ready",
    }).returning();
    await db.insert(chunks).values([
      { fileId: f.id, assistantId: a.id, content: "sobre vendas", chunkIndex: 0, embedding: vec(0) },
      { fileId: f.id, assistantId: a.id, content: "sobre marketing", chunkIndex: 1, embedding: vec(1) },
    ]);
    return a;
  }

  it("retorna só chunks similares, ordenados, com filename", async () => {
    const db = await getTestDb();
    const a = await seed(db);
    const res = await searchChunks(db, a.id, vec(0));
    expect(res).toHaveLength(1); // vec(1) tem similaridade 0 < 0.25
    expect(res[0].content).toBe("sobre vendas");
    expect(res[0].filename).toBe("doc.pdf");
    expect(res[0].similarity).toBeCloseTo(1, 3);
  });

  it("não vaza chunks de outro assistente", async () => {
    const db = await getTestDb();
    const a = await seed(db);
    const [u2] = await db.insert(users).values({ name: "B", email: "b@g4.com", passwordHash: "x" }).returning();
    const [outro] = await db.insert(assistants).values({ name: "O", systemPrompt: "sp", createdBy: u2.id }).returning();
    expect(await searchChunks(db, outro.id, vec(0))).toHaveLength(0);
  });

  it("hasReadyFiles reflete status", async () => {
    const db = await getTestDb();
    const a = await seed(db);
    expect(await hasReadyFiles(db, a.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/rag/search` → FAIL.

- [ ] **Step 3: Implementar**

`apps/web/lib/rag/search.ts`:
```ts
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { assistantFiles, chunks } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function searchChunks(db: Db, assistantId: string, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const minSimilarity = opts.minSimilarity ?? 0.25;
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;
  return db.select({
    content: chunks.content,
    filename: assistantFiles.filename,
    similarity,
  })
    .from(chunks)
    .innerJoin(assistantFiles, eq(chunks.fileId, assistantFiles.id))
    .where(and(eq(chunks.assistantId, assistantId), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(k);
}

export async function hasReadyFiles(db: Db, assistantId: string) {
  const rows = await db.select({ id: assistantFiles.id }).from(assistantFiles)
    .where(and(eq(assistantFiles.assistantId, assistantId), eq(assistantFiles.status, "ready"))).limit(1);
  return rows.length > 0;
}
```

`apps/web/lib/ai/knowledge-tool.ts`:
```ts
import { embed, tool } from "ai";
import { z } from "zod";
import { searchChunks } from "@/lib/rag/search";
import type { Db } from "@/lib/db";
import type { createOpenAI } from "@ai-sdk/openai";

export function makeKnowledgeTool(db: Db, openai: ReturnType<typeof createOpenAI>, assistantId: string) {
  return tool({
    description: "Busca trechos relevantes na base de conhecimento deste assistente (documentos enviados pelo administrador). Use sempre que a pergunta puder ser respondida por esses documentos.",
    inputSchema: z.object({
      consulta: z.string().describe("Pergunta ou termos de busca em português"),
    }),
    execute: async ({ consulta }) => {
      const { embedding } = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: consulta,
      });
      const resultados = await searchChunks(db, assistantId, embedding);
      if (resultados.length === 0) return "Nenhum trecho relevante encontrado na base de conhecimento.";
      return resultados.map((r, i) => `[${i + 1}] (${r.filename})\n${r.content}`).join("\n\n---\n\n");
    },
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/rag` → PASS.

- [ ] **Step 5: Ligar no /api/chat**

Em `apps/web/app/api/chat/route.ts`, antes do `streamText`:
```ts
import { makeKnowledgeTool } from "@/lib/ai/knowledge-tool";
import { hasReadyFiles } from "@/lib/rag/search";
// ...
const temBase = assistant ? await hasReadyFiles(db, assistant.id) : false;
const tools = temBase && assistant ? { buscarConhecimento: makeKnowledgeTool(db, openai, assistant.id) } : undefined;
const systemExtra = temBase
  ? "\n\nVocê tem acesso à tool buscarConhecimento com documentos enviados pelo administrador. Consulte-a antes de responder perguntas factuais sobre o negócio e cite o arquivo de origem."
  : "";
```
E no `streamText`: `system: (assistant?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) + systemExtra, tools,`.

No `message-list.tsx`: para parts com `type === "tool-buscarConhecimento"`, renderizar chip discreto "🔎 Consultando base de conhecimento…" (estado `input-available`) ou "✓ Base consultada" (estado `output-available`).

- [ ] **Step 6: Verificação manual** — criar assistente com PDF, aguardar "Pronto", conversar perguntando algo do documento; o modelo deve chamar a tool e citar o arquivo.

- [ ] **Step 7: Build + commit** — `npm run build && git add -A && git commit -m "feat: RAG com busca vetorial e tool buscarConhecimento no chat"`
