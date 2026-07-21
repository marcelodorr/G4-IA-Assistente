import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { searchChunks, hasReadyFiles } from "./search";
import { users, assistants, assistantFiles, chunks } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

function vec(hotIndex: number): number[] {
  const v = new Array(1536).fill(0); v[hotIndex] = 1; return v;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("searchChunks", () => {
  beforeEach(truncateAll);

  async function seed(db: Db) {
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
    await seed(db);
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
