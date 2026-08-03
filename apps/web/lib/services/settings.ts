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
    hasElevenLabsKey: Boolean(row?.elevenlabsKeyEncrypted || process.env.ELEVENLABS_API_KEY?.trim()),
    hasRecallApiKey: Boolean(row?.recallApiKeyEncrypted || process.env.RECALL_API_KEY?.trim()),
    hasRecallWebhookSecret: Boolean(row?.recallWebhookSecretEncrypted || process.env.RECALL_WORKSPACE_VERIFICATION_SECRET?.trim()),
    recallRegion: row?.recallRegion ?? process.env.RECALL_REGION ?? "us-east-1",
    recallBotName: row?.recallBotName ?? "Sequor Copiloto",
    dailyTokenLimit: row?.dailyTokenLimit ?? 200_000,
    weeklyTokenLimit: row?.weeklyTokenLimit ?? 1_000_000,
    monthlyTokenLimit: row?.monthlyTokenLimit ?? 4_000_000,
    maxOutputTokens: row?.maxOutputTokens ?? 2_048,
    disabledModels,
    autoLearnEnabled: row?.autoLearnEnabled ?? true,
    systemVersion: row?.systemVersion ?? process.env.APP_VERSION ?? "0.1.0",
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

export async function saveElevenLabsKey(db: Db | Tx, key: string) {
  if (!key.trim()) throw new Error("Chave ElevenLabs vazia");
  await upsert(db, { elevenlabsKeyEncrypted: encrypt(key.trim()) });
}

export async function getElevenLabsKey(db: Db | Tx): Promise<string> {
  const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const row = await getRow(db);
  if (!row?.elevenlabsKeyEncrypted) throw new Error("Chave ElevenLabs não configurada pelo administrador");
  return decrypt(row.elevenlabsKeyEncrypted);
}

const RECALL_REGIONS = ["us-east-1", "us-west-2", "eu-central-1", "ap-northeast-1"] as const;
export type RecallRegion = typeof RECALL_REGIONS[number];

export function isRecallRegion(value: unknown): value is RecallRegion {
  return typeof value === "string" && RECALL_REGIONS.includes(value as RecallRegion);
}

export async function saveRecallSettings(db: Db | Tx, input: { apiKey?: string; webhookSecret?: string; region: RecallRegion; botName: string }) {
  const botName = input.botName.trim();
  if (!botName) throw new Error("Nome do bot é obrigatório");
  await upsert(db, {
    ...(input.apiKey?.trim() ? { recallApiKeyEncrypted: encrypt(input.apiKey.trim()) } : {}),
    ...(input.webhookSecret?.trim() ? { recallWebhookSecretEncrypted: encrypt(input.webhookSecret.trim()) } : {}),
    recallRegion: input.region,
    recallBotName: botName.slice(0, 100),
  });
}

export async function getRecallConfig(db: Db | Tx) {
  const row = await getRow(db);
  const apiKey = process.env.RECALL_API_KEY?.trim() || (row?.recallApiKeyEncrypted ? decrypt(row.recallApiKeyEncrypted) : "");
  const webhookSecret = process.env.RECALL_WORKSPACE_VERIFICATION_SECRET?.trim() || (row?.recallWebhookSecretEncrypted ? decrypt(row.recallWebhookSecretEncrypted) : "");
  const region = process.env.RECALL_REGION?.trim() || row?.recallRegion || "us-east-1";
  if (!apiKey) throw new Error("Recall.ai não configurado pelo administrador");
  if (!webhookSecret) throw new Error("Segredo de verificação Recall.ai não configurado");
  if (!isRecallRegion(region)) throw new Error("Região Recall.ai inválida");
  return { apiKey, webhookSecret, region, botName: row?.recallBotName || "Sequor Copiloto" };
}

export async function setDefaultModel(db: Db | Tx, model: string) {
  const trimmed = model.trim();
  if (!trimmed || !isAllowedModel(trimmed)) throw new Error("Modelo inválido");
  await upsert(db, { defaultModel: trimmed });
}

export async function setAiControls(db: Db | Tx, input: {
  defaultModel: string;
  dailyTokenLimit: number;
  weeklyTokenLimit: number;
  monthlyTokenLimit: number;
  maxOutputTokens: number;
  disabledModels: string[];
}) {
  if (!isAllowedModel(input.defaultModel)) throw new Error("Modelo inválido");
  const disabledModels = [...new Set(input.disabledModels)];
  if (disabledModels.some((model) => !isAllowedModel(model))) throw new Error("Modelo desabilitado inválido");
  if (!isModelEnabled(input.defaultModel, disabledModels)) throw new Error("O modelo padrão não pode estar desabilitado");
  if (!Number.isInteger(input.dailyTokenLimit) || input.dailyTokenLimit < 1_000) throw new Error("Limite diário inválido");
  if (!Number.isInteger(input.weeklyTokenLimit) || input.weeklyTokenLimit < input.dailyTokenLimit) throw new Error("Limite semanal inválido");
  if (!Number.isInteger(input.monthlyTokenLimit) || input.monthlyTokenLimit < input.dailyTokenLimit) throw new Error("Limite mensal inválido");
  if (input.monthlyTokenLimit < input.weeklyTokenLimit) throw new Error("O limite mensal deve ser maior ou igual ao semanal");
  if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 128 || input.maxOutputTokens > 16_384) throw new Error("Limite de resposta inválido");
  await upsert(db, {
    defaultModel: input.defaultModel,
    dailyTokenLimit: input.dailyTokenLimit,
    weeklyTokenLimit: input.weeklyTokenLimit,
    monthlyTokenLimit: input.monthlyTokenLimit,
    maxOutputTokens: input.maxOutputTokens,
    disabledModels,
  });
}

export async function setSystemVersion(db: Db | Tx, version: string) {
  const normalized = version.trim().replace(/^v(?=\d)/i, "");
  if (!/^[a-z0-9][a-z0-9._+-]{0,39}$/i.test(normalized)) {
    throw new Error("Informe uma versão válida, como 1.0.0 ou 2026.07.1");
  }
  await upsert(db, { systemVersion: normalized });
}

export async function markSetupCompleted(db: Db | Tx) {
  await upsert(db, { setupCompleted: true });
}
