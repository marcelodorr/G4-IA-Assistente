// Teste de integração da rota de chat com a OpenAI mockada (sem navegador).
//
// Decisão do usuário (2026-07-21): priorizar testes unitários/integração em
// vez de E2E — este teste cobre o caminho crítico completo (streaming +
// persistência de mensagens + geração de título) na camada da API.
//
// Duas pegadinhas resolvidas aqui, documentadas para quem for mexer depois:
//
// 1) A rota (`app/api/chat/route.ts`) importa `db` de `@/lib/db`, que lê
//    `process.env.DATABASE_URL` uma única vez, no top-level do módulo, para
//    criar o client do postgres-js. Nossos seeds usam `getTestDb()`
//    (test/helpers/db.ts), que lê `TEST_DATABASE_URL` — um banco DIFERENTE
//    (g4_test) do `DATABASE_URL` normal. Se não alinharmos os dois, a rota
//    grava num banco e o teste lê de outro.
//    Solução: apontar `DATABASE_URL` para o mesmo valor de `TEST_DATABASE_URL`
//    ANTES do módulo `@/lib/db` ser avaliado. Como imports estáticos em
//    ESM/vite-node são avaliados antes do corpo do próprio arquivo de teste
//    (confirmado empiricamente: uma atribuição simples de `process.env` antes
//    do `import` NÃO é suficiente — o import já roda primeiro), usamos
//    `vi.hoisted()`, que o Vitest garante rodar antes de qualquer import.
//
// 2) `auth()` (`@/lib/auth`) precisa devolver uma sessão do usuário seedado,
//    mas o id do usuário só existe depois do seed (dentro do teste). Por
//    isso o mock de `@/lib/auth` lê de um objeto mutável (`authState`) —
//    o factory do `vi.mock` só é *chamado* (lazy) quando `auth()` é de fato
//    invocado pela rota, bem depois do seed já ter preenchido `authState`.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  // precisa rodar antes do import de "@/app/api/chat/route" (que importa
  // "@/lib/db", cujo client é criado no top-level do módulo).
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
});

const authState = { userId: "", name: "", email: "" };

vi.mock("@/lib/auth", () => ({
  auth: async () => ({
    user: { id: authState.userId, name: authState.name, email: authState.email, role: "member" },
  }),
}));

import { eq } from "drizzle-orm";
import { POST } from "@/app/api/chat/route";
import { conversations, messages, users } from "@/lib/db/schema";
import { saveOpenAIKey, setDefaultModel } from "@/lib/services/settings";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { FIXED_REPLY, startMockOpenAI } from "@/test/mocks/openai-server.mjs";

const TEST_ENCRYPTION_KEY = "d".repeat(64);

describe.skipIf(!process.env.TEST_DATABASE_URL)("POST /api/chat (integração com OpenAI mockada)", () => {
  let mock: Awaited<ReturnType<typeof startMockOpenAI>>;

  beforeAll(async () => {
    mock = await startMockOpenAI();
    process.env.OPENAI_BASE_URL = `${mock.url}/v1`;
  });

  afterAll(async () => {
    await mock.close();
  });

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    await truncateAll();
  });

  it("faz streaming da resposta mockada e persiste mensagens + título", async () => {
    const db = await getTestDb();

    const [user] = await db
      .insert(users)
      .values({ name: "Usuária de Teste", email: "teste@g4.com", passwordHash: "hash-fake" })
      .returning();
    authState.userId = user.id;
    authState.name = user.name;
    authState.email = user.email;

    await saveOpenAIKey(db, "sk-test-mock-key");
    await setDefaultModel(db, "gpt-4o-mini");

    const [conversation] = await db.insert(conversations).values({ userId: user.id }).returning();

    const request = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { id: "m1", role: "user", parts: [{ type: "text", text: "Olá, G4!" }] },
        ],
        conversationId: conversation.id,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const bodyText = await response.text();
    if (response.status !== 200) {
      throw new Error(`POST /api/chat retornou ${response.status}: ${bodyText}`);
    }
    expect(bodyText).toContain(FIXED_REPLY);

    // onFinish (persistência + título) roda depois do fim do stream — espera
    // até ~5s para dar tempo do write assíncrono terminar.
    const deadline = Date.now() + 5000;
    let persistedMessages: (typeof messages.$inferSelect)[] = [];
    let persistedTitle: string | null = null;
    while (Date.now() < deadline) {
      persistedMessages = await db.select().from(messages).where(eq(messages.conversationId, conversation.id));
      const [row] = await db.select().from(conversations).where(eq(conversations.id, conversation.id));
      persistedTitle = row?.title ?? null;
      if (persistedMessages.length === 2 && persistedTitle) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(persistedMessages).toHaveLength(2);
    expect(persistedMessages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(persistedTitle).toBeTruthy();
  });
});
