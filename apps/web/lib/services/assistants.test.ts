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
