import { beforeEach, describe, expect, it } from "vitest";
import { assistants, users } from "@/lib/db/schema";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { filterUserModels, getUserAccess, normalizeAllowedModels, setUserPermissions } from "./users";

describe("user access helpers", () => {
  it("normaliza e filtra modelos desconhecidos", () => {
    expect(normalizeAllowedModels(null)).toBeNull();
    expect(normalizeAllowedModels(["gpt-5-mini", "inválido", "gpt-5-mini"])).toEqual(["gpt-5-mini"]);
    expect(filterUserModels(["gpt-5", "gpt-5-mini"], ["gpt-5-mini"])).toEqual(["gpt-5-mini"]);
    expect(filterUserModels(["gpt-5"], null)).toEqual(["gpt-5"]);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("user permissions", () => {
  beforeEach(truncateAll);

  it("persiste modelos e somente os assistentes selecionados", async () => {
    const db = await getTestDb();
    const [user] = await db.insert(users).values({ name: "U", email: "access@sequor.com.br", passwordHash: "x" }).returning();
    const [admin] = await db.insert(users).values({ name: "A", email: "admin-access@sequor.com.br", passwordHash: "x", role: "admin" }).returning();
    const [assistant] = await db.insert(assistants).values({ name: "Comercial", systemPrompt: "Ajude", createdBy: admin.id }).returning();
    await setUserPermissions(db, user.id, { allowedModels: ["gpt-5-mini"], assistantAccessMode: "selected", assistantIds: [assistant.id] });
    await expect(getUserAccess(db, user.id)).resolves.toEqual({
      allowedModels: ["gpt-5-mini"],
      assistantAccessMode: "selected",
      assistantIds: [assistant.id],
    });
  });
});
