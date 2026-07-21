# G4 IA Assistente — Plano de Implementação (Parte 2: Deploy Railway + CLI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar o app para produção no Railway (Dockerfile + migrations no boot + healthcheck) e entregar a CLI `npx g4-ia-assistente` que faz o deploy completo na conta Railway do aluno, além do smoke e2e e documentação.

**Architecture:** Imagem Docker standalone do Next.js que roda migrations no start; CLI Node pura (Win/mac/Linux) que orquestra a Railway CLI já logada do aluno: baixa o código via tarball do GitHub, cria projeto, Postgres, variáveis, volume, deploy e domínio.

**Tech Stack:** Docker (node:22-alpine), railway.json, @clack/prompts, cross-spawn, picocolors, tar, open, Vitest, Playwright.

**Pré-requisito:** Parte 1 (`2026-07-21-g4-ia-assistente-web.md`) concluída.

## Global Constraints

- Mesmas constraints globais da Parte 1 (idioma pt-BR, Node >= 22, envs `DATABASE_URL/AUTH_SECRET/ENCRYPTION_KEY/DATA_DIR/AUTH_TRUST_HOST`).
- CLI: **sem** dependência de git ou shell scripts; apenas Node + Railway CLI do aluno. Toda saída em pt-BR.
- Repo GitHub do app: `GuilhermeMReis/G4-IA-Assistente` (tarball `https://codeload.github.com/GuilhermeMReis/G4-IA-Assistente/tar.gz/refs/heads/main`).
- Nome do pacote npm da CLI: `g4-ia-assistente`, bin `g4-ia-assistente`.
- Flags da Railway CLI usadas: `init --name`, `add --database postgres`, `add --service app --variables`, `volume add`, `up --service app --detach`, `domain --service app`, `whoami`, `status`. **Verificar com `railway <cmd> --help` na primeira execução real** — se alguma flag tiver mudado, ajustar em `steps.ts` (única fonte).

---

### Task 19: Produção — Dockerfile, migrations no boot, healthcheck

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `railway.json`, `apps/web/scripts/start.mjs`, `apps/web/app/api/health/route.ts`
- Modify: `apps/web/next.config.ts` (output standalone)

**Interfaces:**
- Produces: imagem Docker que roda `node start.mjs` (migra e sobe o server em `0.0.0.0:$PORT`); `GET /api/health` → `{ ok: true }` (200) ou `{ ok: false }` (503).

- [ ] **Step 1: Health route**

`apps/web/app/api/health/route.ts`:
```ts
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
```

- [ ] **Step 2: Standalone output**

Em `apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 3: Script de start com migrations**

`apps/web/scripts/start.mjs`:
```js
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

console.log("[start] aplicando migrations...");
const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[start] migrations ok");
} catch (e) {
  if (String(e).includes("vector")) {
    console.error("[start] ERRO: extensão pgvector indisponível neste Postgres. Use a imagem pgvector/pgvector ou um Postgres do Railway com pgvector.");
  }
  throw e;
} finally {
  await client.end();
}
await import("./apps/web/server.js");
```

- [ ] **Step 4: Dockerfile e .dockerignore**

`Dockerfile` (raiz do repo):
```dockerfile
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root

FROM deps AS build
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/drizzle ./drizzle
COPY apps/web/scripts/start.mjs ./start.mjs
EXPOSE 3000
CMD ["node", "start.mjs"]
```
Nota de verificação: o diretório standalone de um monorepo contém `apps/web/server.js` e `node_modules` na raiz — conferir com `ls .next/standalone` após o primeiro build; se o layout diferir, ajustar os COPY e o import do `start.mjs` de acordo. `drizzle-orm` e `postgres` estarão no node_modules do standalone porque o app os importa.

`.dockerignore`:
```
node_modules
**/node_modules
.next
.git
data
docs
packages
*.md
.env*
docker-compose.yml
```

`railway.json` (raiz):
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- [ ] **Step 5: Verificar build e execução local (opcional — só se houver Docker na máquina)**

```bash
docker build -t g4-ia-app .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="<TEST_DATABASE_URL do .env (Railway)>" \
  -e AUTH_SECRET=dev -e ENCRYPTION_KEY=$(printf 'a%.0s' {1..64}) \
  -e DATA_DIR=/tmp/data -e AUTH_TRUST_HOST=true \
  g4-ia-app
```
Esperado: log "migrations ok", server no ar; `curl localhost:3000/api/health` → `{"ok":true}`.
Sem Docker local, a validação definitiva acontece no primeiro deploy real via CLI (Task 20, Step 8) — o Railway builda o Dockerfile na nuvem.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: build de produção com Docker, migrations no boot e healthcheck"`

### Task 20: CLI de bootstrap (`packages/cli`)

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/src/index.ts`, `packages/cli/src/runner.ts`, `packages/cli/src/steps.ts`, `packages/cli/src/download.ts`, `packages/cli/README.md`
- Test: `packages/cli/src/steps.test.ts`, `packages/cli/src/download.test.ts`

**Interfaces:**
- Produces (todas em `steps.ts`, recebendo `Runner` injetado — testáveis sem Railway):
  - `type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<{ code: number; stdout: string; stderr: string }>`
  - `checkRailway(run): Promise<{ ok: true } | { ok: false; motivo: "nao-instalada" | "nao-logada" }>`
  - `generateSecrets(rand?): { AUTH_SECRET: string; ENCRYPTION_KEY: string }` — base64url 32 bytes / hex 64 chars
  - `createProject(run, cwd, nome)`, `addDatabase(run, cwd)`, `addAppService(run, cwd, secrets)`, `addVolume(run, cwd)`, `deploy(run, cwd)` — lançam `Error` com stderr quando `code !== 0`
  - `getDomain(run, cwd): Promise<string>` — extrai primeira URL `https://...` do stdout
  - `isLinkedProject(run, cwd): Promise<boolean>` — `railway status` code 0
  - `downloadCode(destDir, opts?: { tarballUrl?, fetchImpl? }): Promise<void>` (em `download.ts`)

- [ ] **Step 1: Scaffold do pacote**

`packages/cli/package.json`:
```json
{
  "name": "g4-ia-assistente",
  "version": "0.1.0",
  "description": "Instala o G4 IA Assistente na sua conta Railway",
  "license": "MIT",
  "type": "module",
  "bin": { "g4-ia-assistente": "./dist/index.js" },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=20" },
  "scripts": { "build": "tsc", "test": "vitest run", "prepublishOnly": "npm run build" },
  "dependencies": {
    "@clack/prompts": "^0.11.0",
    "cross-spawn": "^7.0.6",
    "open": "^10.1.0",
    "picocolors": "^1.1.0",
    "tar": "^7.4.0"
  },
  "devDependencies": {
    "@types/cross-spawn": "^6.0.6",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```
Rodar `npm install` na raiz para linkar o workspace.

- [ ] **Step 2: Testes que falham (steps)**

`packages/cli/src/steps.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkRailway, generateSecrets, createProject, addAppService, getDomain, isLinkedProject } from "./steps";

type Call = { cmd: string; args: string[] };

function fakeRunner(script: Record<string, { code: number; stdout?: string; stderr?: string }>) {
  const calls: Call[] = [];
  const run = async (cmd: string, args: string[]) => {
    calls.push({ cmd, args });
    const key = `${cmd} ${args.join(" ")}`;
    const hit = Object.entries(script).find(([k]) => key.startsWith(k));
    return { code: hit?.[1].code ?? 0, stdout: hit?.[1].stdout ?? "", stderr: hit?.[1].stderr ?? "" };
  };
  return { run, calls };
}

describe("checkRailway", () => {
  it("detecta CLI não instalada", async () => {
    const { run } = fakeRunner({ "railway --version": { code: 127 } });
    expect(await checkRailway(run)).toEqual({ ok: false, motivo: "nao-instalada" });
  });
  it("detecta não logado", async () => {
    const { run } = fakeRunner({ "railway --version": { code: 0 }, "railway whoami": { code: 1 } });
    expect(await checkRailway(run)).toEqual({ ok: false, motivo: "nao-logada" });
  });
  it("ok quando instalada e logada", async () => {
    const { run } = fakeRunner({});
    expect(await checkRailway(run)).toEqual({ ok: true });
  });
});

describe("generateSecrets", () => {
  it("gera ENCRYPTION_KEY hex de 64 chars e AUTH_SECRET não-vazio", () => {
    const s = generateSecrets();
    expect(s.ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(s.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(generateSecrets().ENCRYPTION_KEY).not.toBe(s.ENCRYPTION_KEY);
  });
});

describe("createProject", () => {
  it("chama railway init com o nome", async () => {
    const { run, calls } = fakeRunner({});
    await createProject(run, "/tmp/app", "meu-assistente");
    expect(calls[0]).toEqual({ cmd: "railway", args: ["init", "--name", "meu-assistente"] });
  });
  it("lança com stderr quando falha", async () => {
    const { run } = fakeRunner({ "railway init": { code: 1, stderr: "boom" } });
    await expect(createProject(run, "/tmp/app", "x")).rejects.toThrow(/boom/);
  });
});

describe("addAppService", () => {
  it("passa todas as variáveis", async () => {
    const { run, calls } = fakeRunner({});
    await addAppService(run, "/tmp/app", { AUTH_SECRET: "s3", ENCRYPTION_KEY: "e".repeat(64) });
    const args = calls[0].args.join(" ");
    expect(args).toContain("add --service app");
    expect(args).toContain("AUTH_SECRET=s3");
    expect(args).toContain(`ENCRYPTION_KEY=${"e".repeat(64)}`);
    expect(args).toContain("DATABASE_URL=${{Postgres.DATABASE_URL}}");
    expect(args).toContain("DATA_DIR=/data");
    expect(args).toContain("AUTH_TRUST_HOST=true");
  });
});

describe("getDomain", () => {
  it("extrai a URL do stdout", async () => {
    const { run } = fakeRunner({ "railway domain": { code: 0, stdout: "Service Domain created:\nhttps://meu-app.up.railway.app\n" } });
    expect(await getDomain(run, "/tmp/app")).toBe("https://meu-app.up.railway.app");
  });
});

describe("isLinkedProject", () => {
  it("true quando railway status funciona", async () => {
    const { run } = fakeRunner({});
    expect(await isLinkedProject(run, "/tmp/app")).toBe(true);
  });
  it("false quando não linkado", async () => {
    const { run } = fakeRunner({ "railway status": { code: 1 } });
    expect(await isLinkedProject(run, "/tmp/app")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `cd packages/cli && npx vitest run src/steps` → FAIL.

- [ ] **Step 4: Implementar runner e steps**

`packages/cli/src/runner.ts`:
```ts
import spawn from "cross-spawn";

export type RunResult = { code: number; stdout: string; stderr: string };
export type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<RunResult>;

export const run: Runner = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", () => resolve({ code: 127, stdout, stderr: `comando não encontrado: ${cmd}` }));
  });
```

`packages/cli/src/steps.ts`:
```ts
import { randomBytes } from "crypto";
import type { Runner } from "./runner.js";

async function exec(run: Runner, cwd: string, args: string[], descricao: string) {
  const res = await run("railway", args, { cwd });
  if (res.code !== 0) {
    throw new Error(`Falha ao ${descricao}: ${res.stderr || res.stdout || `código ${res.code}`}`);
  }
  return res;
}

export async function checkRailway(run: Runner): Promise<{ ok: true } | { ok: false; motivo: "nao-instalada" | "nao-logada" }> {
  if ((await run("railway", ["--version"])).code !== 0) return { ok: false, motivo: "nao-instalada" };
  if ((await run("railway", ["whoami"])).code !== 0) return { ok: false, motivo: "nao-logada" };
  return { ok: true };
}

export function generateSecrets(rand: (n: number) => Buffer = randomBytes) {
  return {
    AUTH_SECRET: rand(32).toString("base64url"),
    ENCRYPTION_KEY: rand(32).toString("hex"),
  };
}

export const createProject = (run: Runner, cwd: string, nome: string) =>
  exec(run, cwd, ["init", "--name", nome], "criar o projeto no Railway");

export const addDatabase = (run: Runner, cwd: string) =>
  exec(run, cwd, ["add", "--database", "postgres"], "provisionar o Postgres");

export const addAppService = (run: Runner, cwd: string, secrets: { AUTH_SECRET: string; ENCRYPTION_KEY: string }) =>
  exec(run, cwd, [
    "add", "--service", "app",
    "--variables", `AUTH_SECRET=${secrets.AUTH_SECRET}`,
    "--variables", `ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`,
    "--variables", "DATABASE_URL=${{Postgres.DATABASE_URL}}",
    "--variables", "DATA_DIR=/data",
    "--variables", "AUTH_TRUST_HOST=true",
  ], "criar o serviço do app");

export const addVolume = (run: Runner, cwd: string) =>
  exec(run, cwd, ["volume", "add", "--mount-path", "/data", "--service", "app"], "anexar o volume de dados");

export const deploy = (run: Runner, cwd: string) =>
  exec(run, cwd, ["up", "--service", "app", "--detach"], "fazer o deploy");

export async function getDomain(run: Runner, cwd: string): Promise<string> {
  const res = await exec(run, cwd, ["domain", "--service", "app"], "gerar o domínio público");
  const match = res.stdout.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`Não foi possível identificar a URL no retorno: ${res.stdout}`);
  return match[0].replace(/[),.]$/, "");
}

export async function isLinkedProject(run: Runner, cwd: string): Promise<boolean> {
  return (await run("railway", ["status"], { cwd })).code === 0;
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/steps` → PASS.

- [ ] **Step 6: Download do código (teste + implementação)**

`packages/cli/src/download.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import * as tar from "tar";
import { downloadCode } from "./download";

describe("downloadCode", () => {
  it("baixa e extrai o tarball removendo a pasta raiz", async () => {
    // monta um tarball fixture: raiz/README.md
    const src = mkdtempSync(path.join(tmpdir(), "g4-src-"));
    mkdirSync(path.join(src, "G4-IA-Assistente-main"));
    writeFileSync(path.join(src, "G4-IA-Assistente-main", "README.md"), "# app");
    const tarball = path.join(src, "repo.tgz");
    await tar.c({ gzip: true, file: tarball, cwd: src }, ["G4-IA-Assistente-main"]);

    const dest = mkdtempSync(path.join(tmpdir(), "g4-dest-"));
    const fakeFetch = (async () => new Response(readFileSync(tarball))) as typeof fetch;
    await downloadCode(dest, { fetchImpl: fakeFetch });

    expect(existsSync(path.join(dest, "README.md"))).toBe(true);
  });

  it("lança em resposta HTTP de erro", async () => {
    const dest = mkdtempSync(path.join(tmpdir(), "g4-dest2-"));
    const fakeFetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    await expect(downloadCode(dest, { fetchImpl: fakeFetch })).rejects.toThrow(/baixar/i);
  });
});
```
Rodar e ver falhar, então implementar:

`packages/cli/src/download.ts`:
```ts
import { mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as tar from "tar";

const TARBALL_URL = "https://codeload.github.com/GuilhermeMReis/G4-IA-Assistente/tar.gz/refs/heads/main";

export async function downloadCode(destDir: string, opts: { tarballUrl?: string; fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = opts.tarballUrl ?? TARBALL_URL;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Falha ao baixar o código (${res.status}). Verifique sua conexão.`);
  const tmp = path.join(tmpdir(), `g4-ia-${Date.now()}.tgz`);
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  await mkdir(destDir, { recursive: true });
  await tar.x({ file: tmp, cwd: destDir, strip: 1 });
  await rm(tmp, { force: true });
}
```
Rodar `npx vitest run src/download` → PASS.

- [ ] **Step 7: Fluxo principal (index.ts)**

`packages/cli/src/index.ts`:
```ts
#!/usr/bin/env node
import { intro, outro, text, confirm, spinner, isCancel, cancel, log } from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import os from "os";
import open from "open";
import { run } from "./runner.js";
import { checkRailway, generateSecrets, createProject, addDatabase, addAppService, addVolume, deploy, getDomain, isLinkedProject } from "./steps.js";
import { downloadCode } from "./download.js";

const dourado = (s: string) => pc.bold(pc.yellow(s));

async function main() {
  intro(dourado("G4 IA Assistente — instalação no Railway"));

  const check = await checkRailway(run);
  if (!check.ok) {
    if (check.motivo === "nao-instalada") {
      log.error("A Railway CLI não está instalada.");
      log.info("Instale com: " + pc.cyan("npm install -g @railway/cli") + " (ou brew install railway no mac)");
    } else {
      log.error("Você não está logado na Railway CLI.");
      log.info("Rode: " + pc.cyan("railway login") + " e depois execute este comando de novo.");
    }
    process.exit(1);
  }

  const appDir = path.join(os.homedir(), ".g4-ia-assistente", "app");
  const s = spinner();

  const jaExiste = await isLinkedProject(run, appDir).catch(() => false);
  if (jaExiste) {
    const atualizar = await confirm({ message: "Já existe uma instalação. Atualizar o deploy existente?" });
    if (isCancel(atualizar) || !atualizar) { cancel("Nada foi alterado."); process.exit(0); }
    s.start("Baixando a versão mais recente");
    await downloadCode(appDir);
    s.stop("Código atualizado");
    s.start("Fazendo redeploy no Railway (isso pode levar alguns minutos)");
    await deploy(run, appDir);
    s.stop("Redeploy enviado");
    outro(dourado("Atualização concluída! ✦"));
    return;
  }

  const nome = await text({
    message: "Nome do projeto no Railway:",
    initialValue: "g4-ia-assistente",
    validate: (v) => (/^[a-z0-9-]{3,40}$/.test(v) ? undefined : "Use letras minúsculas, números e hífens (3-40 caracteres)"),
  });
  if (isCancel(nome)) { cancel("Instalação cancelada."); process.exit(0); }

  s.start("Baixando o código do G4 IA Assistente");
  await downloadCode(appDir);
  s.stop("Código baixado");

  s.start("Criando o projeto no Railway");
  await createProject(run, appDir, nome);
  s.stop("Projeto criado");

  s.start("Provisionando o banco Postgres");
  await addDatabase(run, appDir);
  s.stop("Postgres provisionado");

  s.start("Gerando chaves de segurança e configurando o serviço");
  await addAppService(run, appDir, generateSecrets());
  s.stop("Serviço configurado");

  s.start("Anexando volume de arquivos");
  await addVolume(run, appDir);
  s.stop("Volume anexado");

  s.start("Fazendo o deploy (isso pode levar alguns minutos)");
  await deploy(run, appDir);
  s.stop("Deploy enviado");

  s.start("Gerando o endereço público");
  const url = await getDomain(run, appDir);
  s.stop("Endereço pronto");

  log.success(`Seu assistente está em: ${dourado(url)}`);
  log.info("Abrindo o navegador para você concluir a configuração inicial...");
  await open(`${url}/setup`).catch(() => {});
  outro(dourado("Instalação concluída! Finalize o setup no navegador. ✦"));
}

main().catch((e) => {
  log.error(e instanceof Error ? e.message : String(e));
  log.info("Se o problema persistir, rode novamente ou fale com o suporte do G4.");
  process.exit(1);
});
```

- [ ] **Step 8: Build e teste manual local**

```bash
cd packages/cli && npm run build && npm test
node dist/index.js   # com Railway CLI deslogada deve mostrar a instrução de login
```
Teste real completo (opcional, requer conta Railway): `railway login` e rodar `node dist/index.js` até o fim; validar app no ar e wizard abrindo. **Anotar qualquer flag divergente da Railway CLI e corrigir em steps.ts.**

- [ ] **Step 9: README da CLI**

`packages/cli/README.md`: pré-requisitos (Node 20+, Railway CLI logada), comando `npx g4-ia-assistente`, o que a CLI faz (8 passos), atualização (rodar de novo), solução de problemas (não logado, build falhou → `railway logs`).

- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat: CLI g4-ia-assistente para deploy no Railway do aluno"`

### Task 21: Smoke e2e (Playwright + OpenAI mockada)

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `apps/web/test/mocks/openai-server.mjs`, `apps/web/e2e/global-setup.ts`
- Verify: o `/api/chat` usa `openai.chat(modelId)` (API de chat completions, já definido na Parte 1, Task 11) — obrigatório para o mock desta task funcionar.

**Interfaces:**
- Produces: `npm run e2e -w apps/web` — sobe mock OpenAI (porta 8788) + next dev (porta 3100, banco `g4_e2e` migrado) e roda o fluxo setup → chat.

- [ ] **Step 1: Instalar** — `cd apps/web && npm i -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: Mock da OpenAI**

`apps/web/test/mocks/openai-server.mjs`:
```js
import http from "http";

const PORT = Number(process.env.MOCK_PORT ?? 8788);
const RESPOSTA = "Olá! Como posso ajudar o seu negócio hoje?";

function sse(res, chunks) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    if (req.url?.endsWith("/models")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ object: "list", data: [{ id: "gpt-5-mini", object: "model" }] }));
    }
    if (req.url?.endsWith("/embeddings")) {
      const inputs = [].concat(JSON.parse(body).input);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        object: "list", model: "text-embedding-3-small",
        data: inputs.map((_, index) => ({ object: "embedding", index, embedding: Array(1536).fill(0.001) })),
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }));
    }
    if (req.url?.endsWith("/chat/completions")) {
      const base = { id: "chatcmpl-1", object: "chat.completion.chunk", created: 0, model: "gpt-5-mini" };
      return sse(res, [
        { ...base, choices: [{ index: 0, delta: { role: "assistant", content: RESPOSTA }, finish_reason: null }] },
        { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
      ]);
    }
    res.writeHead(404); res.end();
  });
}).listen(PORT, () => console.log(`mock openai na porta ${PORT}`));
```

- [ ] **Step 3: Config e global setup**

`apps/web/e2e/global-setup.ts` — cria/reseta o banco `g4_e2e` (no Postgres de dev do Railway) e roda migrations. `E2E_DATABASE_URL` deve apontar para o banco `g4_e2e` no mesmo servidor do `.env`:
```ts
import { execSync } from "child_process";
import postgres from "postgres";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  const admin = postgres(url.replace(/\/[^/]+$/, "/postgres"));
  await admin.unsafe(`DROP DATABASE IF EXISTS g4_e2e WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE g4_e2e`);
  await admin.end();
  execSync("npx drizzle-kit migrate", {
    cwd: __dirname + "/..",
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
```

`apps/web/playwright.config.ts` (carrega o `.env` como o vitest.config, via `process.loadEnvFile`, e define `E2E_DATABASE_URL` derivada da `TEST_DATABASE_URL` trocando o nome do banco por `g4_e2e` se a env não vier definida):
```ts
import { defineConfig } from "@playwright/test";
import { existsSync } from "fs";
import path from "path";

const envFile = path.resolve(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const E2E_DB = process.env.E2E_DATABASE_URL
  ?? process.env.TEST_DATABASE_URL!.replace(/\/[^/]+$/, "/g4_e2e");
process.env.E2E_DATABASE_URL = E2E_DB;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100" },
  webServer: [
    {
      command: "node test/mocks/openai-server.mjs",
      port: 8788,
      reuseExistingServer: false,
    },
    {
      command: "npx next dev -p 3100",
      port: 3100,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: E2E_DB,
        AUTH_SECRET: "e2e-secret",
        ENCRYPTION_KEY: "f".repeat(64),
        DATA_DIR: "./.e2e-data",
        AUTH_TRUST_HOST: "true",
        OPENAI_BASE_URL: "http://localhost:8788/v1",
      },
    },
  ],
});
```
Adicionar script em `apps/web/package.json`: `"e2e": "playwright test"`.

- [ ] **Step 4: Spec do fluxo completo**

`apps/web/e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("setup → chat com streaming", async ({ page }) => {
  // Wizard de setup
  await page.goto("/setup");
  await page.getByLabel("Seu nome").fill("Admin E2E");
  await page.getByLabel("E-mail").fill("admin@e2e.com");
  await page.getByLabel(/Senha/).fill("senha-e2e-123");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Chave da OpenAI").fill("sk-e2e-fake");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Concluir" }).click();

  // Logado e no chat
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });

  // Envia mensagem e recebe resposta mockada com streaming
  await page.getByPlaceholder("Envie uma mensagem...").fill("Olá, G4!");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Olá! Como posso ajudar o seu negócio hoje?")).toBeVisible({ timeout: 20_000 });

  // Conversa aparece na sidebar após refresh
  await page.reload();
  await expect(page.getByText("Olá! Como posso ajudar o seu negócio hoje?")).toBeVisible();
});
```

- [ ] **Step 5: Rodar** — `npm run e2e -w apps/web` (usa o Postgres de dev do Railway via `.env`) → esperado: 1 passed. Ajustar seletores conforme a UI real se algum falhar (rodar com `--ui` para depurar).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "test: smoke e2e do fluxo setup → chat com OpenAI mockada"`

### Task 22: Documentação final

**Files:**
- Modify: `README.md` (raiz)
- Create: `docs/instalacao-aluno.md`, `docs/desenvolvimento.md`

**Interfaces:**
- Produces: documentação completa para os dois públicos (aluno e desenvolvedor).

- [ ] **Step 1: README raiz**

Reescrever `README.md` com: o que é o projeto (1 parágrafo, marca G4), screenshot placeholder, **Instalação para alunos** (3 comandos: instalar Node, `npm i -g @railway/cli && railway login`, `npx g4-ia-assistente`), link para `docs/instalacao-aluno.md`, seção para desenvolvedores linkando `docs/desenvolvimento.md`, licença.

- [ ] **Step 2: Guia do aluno**

`docs/instalacao-aluno.md` — passo a passo detalhado em pt-BR: criar conta no Railway; instalar Node.js (link, Windows/mac); instalar e logar Railway CLI; rodar `npx g4-ia-assistente`; concluir o wizard (onde criar a chave OpenAI, aviso de custos da API); convidar o time; criar assistentes e subir documentos; como atualizar (rodar `npx g4-ia-assistente` de novo); problemas comuns (não logado, deploy falhou → `railway logs`, chave inválida).

- [ ] **Step 3: Guia do desenvolvedor**

`docs/desenvolvimento.md` — setup local (`docker compose up -d db`, `.env`, `npm install`, migrations, `npm run dev`), rodar testes (`TEST_DATABASE_URL=... npm test -w apps/web`, e2e), estrutura do monorepo, como publicar a CLI (`npm publish -w packages/cli`), como gerar migration nova.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "docs: guias de instalação do aluno e de desenvolvimento"`
