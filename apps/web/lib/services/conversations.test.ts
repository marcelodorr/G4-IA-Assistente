import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { createConversation, listConversations, getConversation, replaceMessages, deleteConversation } from "./conversations";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

async function makeUser(db: Db, email = "u@g4.com") {
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
