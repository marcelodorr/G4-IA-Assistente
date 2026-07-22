import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { assistantFiles, chunks, globalContextChunks, globalContextFiles } from "@/lib/db/schema";
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
    .where(and(eq(chunks.assistantId, assistantId), eq(assistantFiles.status, "ready"), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(k);
}

export async function hasReadyFiles(db: Db, assistantId: string) {
  const rows = await db.select({ id: assistantFiles.id }).from(assistantFiles)
    .where(and(eq(assistantFiles.assistantId, assistantId), eq(assistantFiles.status, "ready"))).limit(1);
  return rows.length > 0;
}

export async function searchGlobalContextChunks(db: Db, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const minSimilarity = opts.minSimilarity ?? 0.25;
  const similarity = sql<number>`1 - (${cosineDistance(globalContextChunks.embedding, embedding)})`;
  return db.select({
    content: globalContextChunks.content,
    filename: globalContextFiles.filename,
    similarity,
  })
    .from(globalContextChunks)
    .innerJoin(globalContextFiles, eq(globalContextChunks.fileId, globalContextFiles.id))
    .where(and(eq(globalContextFiles.status, "ready"), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(k);
}

export async function searchKnowledge(db: Db, assistantId: string | null, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const [globalResults, assistantResults] = await Promise.all([
    searchGlobalContextChunks(db, embedding, { ...opts, k }),
    assistantId ? searchChunks(db, assistantId, embedding, { ...opts, k }) : Promise.resolve([]),
  ]);
  return [...globalResults, ...assistantResults]
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))
    .slice(0, k);
}

export async function hasReadyKnowledge(db: Db, assistantId: string | null) {
  const [globalFile, assistantReady] = await Promise.all([
    db.select({ id: globalContextFiles.id }).from(globalContextFiles)
      .where(eq(globalContextFiles.status, "ready")).limit(1),
    assistantId ? hasReadyFiles(db, assistantId) : Promise.resolve(false),
  ]);
  return globalFile.length > 0 || assistantReady;
}
