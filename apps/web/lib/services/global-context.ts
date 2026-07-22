import { desc, eq } from "drizzle-orm";
import { globalContextFiles, settings } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function getGlobalContext(db: Db) {
  const [row] = await db.select({ content: settings.globalContext }).from(settings).where(eq(settings.id, 1));
  return row?.content ?? "";
}

export async function setGlobalContext(db: Db, content: string) {
  const normalized = content.trim();
  if (normalized.length > 50_000) throw new Error("O contexto geral deve ter no máximo 50.000 caracteres");
  await db.insert(settings).values({ id: 1, globalContext: normalized })
    .onConflictDoUpdate({ target: settings.id, set: { globalContext: normalized, updatedAt: new Date() } });
}

export async function listGlobalContextFiles(db: Db) {
  return db.select().from(globalContextFiles).orderBy(desc(globalContextFiles.createdAt));
}
