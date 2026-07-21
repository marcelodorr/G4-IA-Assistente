# G4 IA Assistente — Design

**Data:** 2026-07-21
**Status:** Aprovado

## 1. Visão geral

Um assistente de IA estilo ChatGPT com a marca do G4, distribuído como **template auto-hospedável no Railway**. Cada aluno/cliente do G4 faz o deploy do repositório na própria conta Railway usando uma CLI de bootstrap própria (`npx g4-ia-assistente`). No primeiro acesso à instância, um **wizard de setup** cria o usuário admin, recebe a chave da OpenAI e define o modelo padrão. O admin pode convidar outros usuários e criar **assistentes personalizados com base de conhecimento** (PDFs/Excel vetorizados via pgvector).

**Decisões de escopo confirmadas com o usuário:**

- Público: alunos/clientes do G4 hospedam a própria instância (self-hosted).
- Multi-usuário por instância: admin convida usuários (roles `admin` e `member`).
- v1 inclui: chat com streaming, histórico, markdown, assistentes/personas, upload de arquivos/imagens no chat, seletor de modelo, RAG com pgvector.
- Fora do escopo v1: dashboard de custos/tokens, outros provedores de LLM, cadastro aberto, web search.
- Distribuição da CLI: pacote npm executado via `npx` (requer Node.js + Railway CLI logada).
- Arquitetura: monolito Next.js + Postgres (2 serviços no Railway).

## 2. Estrutura do repositório (monorepo)

```
G4-IA-Assistente/
├── apps/web/        → aplicação Next.js (FE + BE)
├── packages/cli/    → CLI de bootstrap, publicada no npm como `g4-ia-assistente`
└── docs/            → especificações e planos
```

Workspaces npm. A CLI é publicada a partir deste mesmo repositório.

## 3. Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) — FE + BE num só serviço |
| UI | Tailwind CSS v4 + shadcn/ui |
| Auth | Auth.js (NextAuth v5), provider Credentials (e-mail/senha), sessões JWT |
| Senhas | argon2id planejado; **decisão final registrada no plano:** bcryptjs (o build nativo do argon2 se mostrou instável no container do Railway) |
| Banco | PostgreSQL + extensão pgvector; ORM Drizzle (coluna `vector` nativa) |
| IA | Vercel AI SDK + `@ai-sdk/openai` — streaming, tool calling, embeddings `text-embedding-3-small` (1536 dims) |
| Parsing | `unpdf` (PDF), SheetJS/`xlsx` (Excel) |
| Arquivos | Railway Volume montado em `/data` (uploads brutos); chunks e texto extraído no Postgres |
| CLI | Node.js puro, prompts com `@clack/prompts`, execução da Railway CLI via `cross-spawn` |

## 4. Identidade visual (extraída de g4business.com)

- **Cores:** navy escuro `#001F35` / `#0f1a45` (fundos), dourado `#B9915B` (acentos/CTAs), off-white `#F5F4F3`, cinza-borda `#e5e7eb`.
- **Tipografia:** Manrope (corpo/UI); serif itálica (Libre Baskerville) para acentos de display, seguindo o site.
- **Logos:** `https://g4business.com/wp-content/uploads/2026/01/logo-g4-completa-branca.svg` (branca, para fundo navy) e `https://g4business.com/wp-content/uploads/2026/01/g4educacao-logo-escura.svg` (escura). Baixar para o repo em `apps/web/public/brand/`.
- **Estética:** dark premium, raios de borda 8–24px, generoso em espaçamento.

## 5. Modelo de dados (Postgres)

- **users** — id, nome, e-mail (único), hash de senha, role (`admin` | `member`), ativo, timestamps.
- **invites** — token (único), e-mail, role, expiração, usado_em.
- **settings** — linha única: chave OpenAI criptografada (AES-256-GCM), modelo padrão, flag `setup_completed`.
- **assistants** — nome, descrição, system prompt, modelo (opcional, senão usa padrão), criado_por, ativo.
- **assistant_files** — assistant_id, nome do arquivo, mime, tamanho, caminho no volume, status (`pending → processing → ready | error`), mensagem de erro.
- **chunks** — file_id, assistant_id (desnormalizado para busca), conteúdo, `embedding vector(1536)`, chunk_index. Índice HNSW (cosseno).
- **conversations** — user_id, assistant_id (opcional), título (gerado automaticamente após primeira troca), modelo, timestamps.
- **messages** — conversation_id, role (`user` | `assistant`), parts jsonb (formato UIMessage do AI SDK, texto + anexos), timestamps.

Migrations com drizzle-kit, executadas no start do serviço (entrypoint). Primeira migration inclui `CREATE EXTENSION IF NOT EXISTS vector`.

## 6. Fluxos principais

### Setup (primeiro acesso)
Middleware detecta ausência de admin (ou `setup_completed = false`) → redireciona tudo para `/setup`. Wizard em 3 passos:
1. Criar conta admin (nome, e-mail, senha).
2. Colar chave OpenAI — validada com chamada de teste à API antes de salvar criptografada.
3. Escolher modelo padrão (lista fixa curada, ex.: gpt-4o, gpt-4o-mini) → conclui e vai para o chat.

### Autenticação e usuários
- Login por e-mail/senha (`/login`).
- Admin gera link de convite em `/admin/usuarios` (token com expiração); envia o link manualmente; convidado abre `/invite/[token]`, define nome e senha.
- Admin pode desativar usuários (bloqueia login, preserva histórico).

### Chat
- Streaming token a token (AI SDK `streamText` → `useChat`).
- Markdown com highlight de código; botão copiar.
- Sidebar: histórico de conversas do usuário, nova conversa, busca simples por título.
- Ao iniciar conversa: escolha de assistente (opcional — "Chat livre" é o default) e modelo (default do settings).
- Anexos: imagens → enviadas como conteúdo de visão ao modelo; PDFs → texto extraído e injetado no contexto da mensagem. Arquivos salvos em `/data/uploads`.
- Título da conversa gerado automaticamente (chamada barata com modelo mini) após a primeira resposta.

### RAG (base de conhecimento dos assistentes)
- Admin faz upload de PDF/Excel no assistente (`/admin/assistentes/[id]`).
- Pipeline em background no próprio processo Node (Railway é servidor persistente, sem timeout serverless): salvar no volume → parse → chunking ~500 tokens com overlap → embeddings em lote → gravar chunks no pgvector → status `ready`. Status visível na UI com polling.
- No chat com assistente que tem arquivos `ready`: o modelo recebe a tool **`buscarConhecimento`** (AI SDK tools + maxSteps) — decide quando pesquisar; a tool embeda a query, busca top-K (K=8) por similaridade de cosseno com threshold e retorna os trechos com nome do arquivo de origem.

### Admin (`/admin`, apenas role admin)
- Usuários: listar, convidar (gerar link), desativar.
- Assistentes: CRUD + upload/remoção de arquivos da base.
- Configurações: trocar chave OpenAI (revalidada), trocar modelo padrão.

## 7. Segurança

- Chave OpenAI nunca em texto puro: AES-256-GCM, chave derivada de `ENCRYPTION_KEY` (env gerada pela CLI no deploy). Nunca exposta ao cliente; descriptografada só no servidor por request.
- Senhas com argon2id.
- Middleware: rotas `/admin/*` exigem role admin; todas as demais (exceto `/login`, `/invite/*`, `/setup` pré-setup) exigem sessão.
- Uploads validados por MIME e tamanho (limite 20 MB por arquivo).
- Convites com expiração (7 dias) e uso único.

## 8. CLI de bootstrap (`packages/cli`)

**Comando do aluno:** `npx g4-ia-assistente` (Windows/macOS/Linux).
**Pré-requisitos:** Node.js; Railway CLI instalada e logada.

Fluxo (prompts e mensagens em português, cores da marca):
1. **Verificação** — `railway --version` e `railway whoami`; se falhar, instrução exata de instalação/login e encerra.
2. **Código** — baixa tarball da última versão do repo no GitHub (sem exigir git) para pasta local.
3. **Projeto** — `railway init` com nome escolhido pelo aluno.
4. **Banco** — provisiona Postgres com a imagem `pgvector/pgvector:pg17` (o template padrão do Railway não inclui pgvector) com volume e senha gerada pela CLI.
5. **Secrets** — gera `AUTH_SECRET`, `ENCRYPTION_KEY` e a senha do banco com crypto seguro; compõe a `DATABASE_URL` da rede privada (`db.railway.internal`).
6. **Volume** — anexa volume em `/data`.
7. **Deploy** — `railway up`, acompanhando o build.
8. **Domínio** — `railway domain`, imprime URL e abre o navegador em `/setup`.

**Re-execução:** detecta projeto existente (link/status) e oferece atualizar (baixa código novo + redeploy) em vez de duplicar — é o mecanismo de update.

## 9. Testes

- **Vitest (unidade):** chunking, criptografia AES-GCM, montagem da query de similaridade, validação de convites, parsing de PDF/Excel com fixtures.
- **Playwright (e2e smoke):** setup wizard → login → enviar mensagem no chat com OpenAI mockada (servidor de mock ou interceptação de rede).
- **CLI:** testes de unidade com Railway CLI mockada (cross-spawn interceptado).
- Desenvolvimento em TDD.

## 10. Riscos e pontos de verificação na implementação

- **Resolvido (2026-07-21):** o Postgres padrão do Railway (PG18) NÃO inclui pgvector (verificado em projeto real). A CLI provisiona o banco com a imagem `pgvector/pgvector:pg17` + volume, e o app conecta via rede privada (`db.railway.internal:5432`) com senha gerada pela própria CLI.
- Build nativo do argon2 no container do Railway; fallback bcryptjs.
- `railway up` a partir de tarball baixado no Windows (caminhos, exclusões) — testar cedo.
- Tamanho de contexto ao injetar PDFs anexados no chat — truncar com aviso ao usuário.
