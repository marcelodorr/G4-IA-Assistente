import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { assistantFiles, chunks } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function searchChunks(db: Db, assistantId: string, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const minSimilarity = opts.minSimilarity ?? 0.25;
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;
  return db.select({
    content: chunks.content,
    filename: assistantFiles.filename,
    similarity,
  })
    .from(chunks)
    .innerJoin(assistantFiles, eq(chunks.fileId, assistantFiles.id))
    .where(and(eq(chunks.assistantId, assistantId), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(k);
}

export async function hasReadyFiles(db: Db, assistantId: string) {
  const rows = await db.select({ id: assistantFiles.id }).from(assistantFiles)
    .where(and(eq(assistantFiles.assistantId, assistantId), eq(assistantFiles.status, "ready"))).limit(1);
  return rows.length > 0;
}
