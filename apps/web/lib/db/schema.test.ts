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
