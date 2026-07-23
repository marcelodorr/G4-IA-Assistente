import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { assistantFiles, chunks, corporateMemories, globalContextChunks, globalContextFiles, projectChunks, projectFiles } from "@/lib/db/schema";
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

export async function searchProjectChunks(db: Db, projectId: string, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const minSimilarity = opts.minSimilarity ?? 0.25;
  const similarity = sql<number>`1 - (${cosineDistance(projectChunks.embedding, embedding)})`;
  return db.select({ content: projectChunks.content, filename: projectFiles.filename, similarity })
    .from(projectChunks)
    .innerJoin(projectFiles, eq(projectChunks.fileId, projectFiles.id))
    .where(and(eq(projectChunks.projectId, projectId), eq(projectFiles.status, "ready"), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(k);
}

export async function searchKnowledge(db: Db, assistantId: string | null, projectId: string | null, embedding: number[], opts: { k?: number; minSimilarity?: number } = {}) {
  const k = opts.k ?? 8;
  const memorySimilarity = sql<number>`1 - (${cosineDistance(corporateMemories.embedding, embedding)})`;
  const [globalResults, assistantResults, projectResults, memoryResults] = await Promise.all([
    searchGlobalContextChunks(db, embedding, { ...opts, k }),
    assistantId ? searchChunks(db, assistantId, embedding, { ...opts, k }) : Promise.resolve([]),
    projectId ? searchProjectChunks(db, projectId, embedding, { ...opts, k }) : Promise.resolve([]),
    db.select({
      content: corporateMemories.content,
      filename: sql<string>`'Memória corporativa interna'`,
      similarity: memorySimilarity,
    }).from(corporateMemories).where(and(
      eq(corporateMemories.status, "ready"),
      gt(memorySimilarity, opts.minSimilarity ?? 0.25),
    )).orderBy(desc(memorySimilarity)).limit(k),
  ]);
  return [...projectResults, ...globalResults, ...assistantResults, ...memoryResults]
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))
    .slice(0, k);
}

export async function hasReadyKnowledge(db: Db, assistantId: string | null, projectId: string | null = null) {
  const [globalFile, memory, assistantReady, projectReady] = await Promise.all([
    db.select({ id: globalContextFiles.id }).from(globalContextFiles)
      .where(eq(globalContextFiles.status, "ready")).limit(1),
    db.select({ id: corporateMemories.id }).from(corporateMemories).where(eq(corporateMemories.status, "ready")).limit(1),
    assistantId ? hasReadyFiles(db, assistantId) : Promise.resolve(false),
    projectId ? db.select({ id: projectFiles.id }).from(projectFiles)
      .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.status, "ready"))).limit(1).then((rows) => rows.length > 0) : Promise.resolve(false),
  ]);
  return globalFile.length > 0 || memory.length > 0 || assistantReady || projectReady;
}
