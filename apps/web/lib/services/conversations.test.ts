import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { appendChatTurn, createConversation, deleteConversation, finishAssistantMessage, getConversation, listConversations } from "./conversations";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

async function makeUser(db: Db, email = "u@sequor.com.br") {
  const [u] = await db.insert(users).values({ name: "U", email, passwordHash: "x" }).returning();
  return u;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("conversations", () => {
  beforeEach(truncateAll);

  it("cria, lista e lê conversa com mensagens", async () => {
    const db = await getTestDb();
    const u = await makeUser(db);
    const conv = await createConversation(db, { userId: u.id });
    const turn = await appendChatTurn(db, { conversationId: conv.id, clientId: "client-1", userParts: [{ type: "text", text: "Oi" }] });
    await finishAssistantMessage(db, turn.assistantMessage.id, { parts: [{ type: "text", text: "Olá!" }], status: "completed" });
    const got = await getConversation(db, conv.id, u.id);
    expect(got!.messages).toHaveLength(2);
    expect(await listConversations(db, u.id)).toHaveLength(1);
  });

  it("não expõe conversa de outro usuário", async () => {
    const db = await getTestDb();
    const dono = await makeUser(db, "dono@sequor.com.br");
    const outro = await makeUser(db, "outro@sequor.com.br");
    const conv = await createConversation(db, { userId: dono.id });
    expect(await getConversation(db, conv.id, outro.id)).toBeNull();
    await deleteConversation(db, conv.id, outro.id); // não deleta
    expect(await getConversation(db, conv.id, dono.id)).not.toBeNull();
  });

  it("não duplica uma mensagem reenviada pelo cliente", async () => {
    const db = await getTestDb();
    const u = await makeUser(db);
    const conv = await createConversation(db, { userId: u.id });
    await appendChatTurn(db, { conversationId: conv.id, clientId: "mesma", userParts: [{ type: "text", text: "A" }] });
    await expect(appendChatTurn(db, { conversationId: conv.id, clientId: "mesma", userParts: [{ type: "text", text: "A" }] })).rejects.toThrow(/já foi processada/);
    const got = await getConversation(db, conv.id, u.id);
    expect(got!.messages).toHaveLength(2);
  });
});
