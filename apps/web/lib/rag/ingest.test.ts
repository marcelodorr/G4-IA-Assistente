import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { ingestFile } from "./ingest";
import { users, assistants, assistantFiles, chunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";

const fakeEmbed = async (texts: string[]) => texts.map((_, i) => {
  const v = new Array(1536).fill(0); v[i % 1536] = 1; return v;
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("ingestFile", () => {
  beforeEach(async () => {
    await truncateAll();
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "g4-ingest-"));
  });

  async function seed(db: Db, storedName: string) {
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
