import { eq } from "drizzle-orm";
import { settings } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { DEFAULT_MODEL, isAllowedModel, isModelEnabled } from "@/lib/ai/models";
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
  const disabledModels = Array.isArray(row?.disabledModels)
    ? row.disabledModels.filter((item): item is string => typeof item === "string" && isAllowedModel(item))
    : [];
  return {
    defaultModel: row?.defaultModel ?? DEFAULT_MODEL,
    setupCompleted: row?.setupCompleted ?? false,
    hasKey: Boolean(row?.openaiKeyEncrypted),
    dailyTokenLimit: row?.dailyTokenLimit ?? 200_000,
    monthlyTokenLimit: row?.monthlyTokenLimit ?? 4_000_000,
    maxOutputTokens: row?.maxOutputTokens ?? 2_048,
    disabledModels,
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

export async function setAiControls(db: Db | Tx, input: {
  defaultModel: string;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  maxOutputTokens: number;
  disabledModels: string[];
}) {
  if (!isAllowedModel(input.defaultModel)) throw new Error("Modelo inválido");
  const disabledModels = [...new Set(input.disabledModels)];
  if (disabledModels.some((model) => !isAllowedModel(model))) throw new Error("Modelo desabilitado inválido");
  if (!isModelEnabled(input.defaultModel, disabledModels)) throw new Error("O modelo padrão não pode estar desabilitado");
  if (!Number.isInteger(input.dailyTokenLimit) || input.dailyTokenLimit < 1_000) throw new Error("Limite diário inválido");
  if (!Number.isInteger(input.monthlyTokenLimit) || input.monthlyTokenLimit < input.dailyTokenLimit) throw new Error("Limite mensal inválido");
  if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 128 || input.maxOutputTokens > 16_384) throw new Error("Limite de resposta inválido");
  await upsert(db, {
    defaultModel: input.defaultModel,
    dailyTokenLimit: input.dailyTokenLimit,
    monthlyTokenLimit: input.monthlyTokenLimit,
    maxOutputTokens: input.maxOutputTokens,
    disabledModels,
  });
}

export async function markSetupCompleted(db: Db | Tx) {
  await upsert(db, { setupCompleted: true });
}
