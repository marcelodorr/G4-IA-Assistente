import { eq } from "drizzle-orm";
import { settings } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { DEFAULT_MODEL, isAllowedModel } from "@/lib/ai/models";
import type { Db, Tx } from "@/lib/db";

async function getRow(db: Db | Tx) {
  return (await db.select().from(settings).where(eq(settings.id, 1)))[0] ?? null;
}

async function upsert(db: Db | Tx, values: Partial<typeof settings.$inferInsert>) {
  await db.insert(settings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: settings.id, set: { ...values, updatedAt: new Date() } });
}

export async function getSettings(db: Db) {
  const row = await getRow(db);
  return {
    defaultModel: row?.defaultModel ?? DEFAULT_MODEL,
    setupCompleted: row?.setupCompleted ?? false,
    hasKey: Boolean(row?.openaiKeyEncrypted),
  };
}

export async function saveOpenAIKey(db: Db | Tx, key: string) {
  if (!key.trim()) throw new Error("Chave OpenAI vazia");
  await upsert(db, { openaiKeyEncrypted: encrypt(key.trim()) });
}

export async function getOpenAIKey(db: Db): Promise<string> {
  const row = await getRow(db);
  if (!row?.openaiKeyEncrypted) throw new Error("Chave OpenAI não configurada");
  return decrypt(row.openaiKeyEncrypted);
}

export async function setDefaultModel(db: Db | Tx, model: string) {
  const trimmed = model.trim();
  if (!trimmed || !isAllowedModel(trimmed)) throw new Error("Modelo inválido");
  await upsert(db, { defaultModel: trimmed });
}

export async function markSetupCompleted(db: Db | Tx) {
  await upsert(db, { setupCompleted: true });
}
