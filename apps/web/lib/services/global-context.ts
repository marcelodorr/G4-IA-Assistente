import { desc, eq } from "drizzle-orm";
import { globalContextFiles, settings, users } from "@/lib/db/schema";
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

export async function setAutoLearn(db: Db, enabled: boolean) {
  await db.insert(settings).values({ id: 1, autoLearnEnabled: enabled })
    .onConflictDoUpdate({ target: settings.id, set: { autoLearnEnabled: enabled, updatedAt: new Date() } });
}

export async function listGlobalContextFiles(db: Db) {
  return db.select({
    id: globalContextFiles.id,
    filename: globalContextFiles.filename,
    mime: globalContextFiles.mime,
    size: globalContextFiles.size,
    storagePath: globalContextFiles.storagePath,
    status: globalContextFiles.status,
    error: globalContextFiles.error,
    createdBy: globalContextFiles.createdBy,
    sourceType: globalContextFiles.sourceType,
    sourceUserId: globalContextFiles.sourceUserId,
    sourceConversationId: globalContextFiles.sourceConversationId,
    sourceUploadId: globalContextFiles.sourceUploadId,
    sourceUserName: users.name,
    sourceUserEmail: users.email,
    createdAt: globalContextFiles.createdAt,
  }).from(globalContextFiles).leftJoin(users, eq(globalContextFiles.sourceUserId, users.id)).orderBy(desc(globalContextFiles.createdAt));
}
