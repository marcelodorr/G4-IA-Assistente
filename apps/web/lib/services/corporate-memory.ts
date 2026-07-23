import { embed } from "ai";
import { desc, eq } from "drizzle-orm";
import { corporateMemories, users } from "@/lib/db/schema";
import { getProvider } from "@/lib/ai/provider";
import { recordEmbeddingUsage } from "@/lib/services/usage";
import type { Db } from "@/lib/db";

export async function processCorporateMemory(db: Db, id: string) {
  const [memory] = await db.select().from(corporateMemories).where(eq(corporateMemories.id, id));
  if (!memory) throw new Error("Memória não encontrada");
  await db.update(corporateMemories).set({ status: "processing", error: null }).where(eq(corporateMemories.id, id));
  const startedAt = Date.now();
  try {
    const openai = await getProvider(db);
    const result = await embed({ model: openai.textEmbeddingModel("text-embedding-3-small"), value: memory.content });
    await db.update(corporateMemories).set({ status: "ready", embedding: result.embedding }).where(eq(corporateMemories.id, id));
    if (memory.userId) await recordEmbeddingUsage(db, { userId: memory.userId, tokens: result.usage.tokens, durationMs: Date.now() - startedAt, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(corporateMemories).set({ status: "error", error: message }).where(eq(corporateMemories.id, id));
    if (memory.userId) await recordEmbeddingUsage(db, { userId: memory.userId, tokens: 0, durationMs: Date.now() - startedAt, success: false });
  }
}

export async function captureCorporateMemory(db: Db, input: {
  userId: string;
  conversationId?: string;
  messageId?: string;
  content: string;
  sourceType?: "chat" | "integration";
  sourceProvider?: string;
}) {
  const content = input.content.trim().slice(0, 20_000);
  if (content.length < 3) return null;
  const [row] = await db.insert(corporateMemories).values({ ...input, content })
    .onConflictDoNothing({ target: corporateMemories.messageId }).returning();
  if (!row) return null;
  void processCorporateMemory(db, row.id).catch((error) => console.error(`[memória-corporativa] falha ${row.id}:`, error));
  return row;
}

export async function listCorporateMemories(db: Db, limit = 100) {
  return db.select({
    id: corporateMemories.id,
    content: corporateMemories.content,
    sourceType: corporateMemories.sourceType,
    sourceProvider: corporateMemories.sourceProvider,
    status: corporateMemories.status,
    error: corporateMemories.error,
    conversationId: corporateMemories.conversationId,
    userId: corporateMemories.userId,
    userName: users.name,
    userEmail: users.email,
    createdAt: corporateMemories.createdAt,
  }).from(corporateMemories).leftJoin(users, eq(corporateMemories.userId, users.id))
    .orderBy(desc(corporateMemories.createdAt)).limit(Math.min(Math.max(limit, 1), 500));
}

export async function deleteCorporateMemory(db: Db, id: string) {
  await db.delete(corporateMemories).where(eq(corporateMemories.id, id));
}
