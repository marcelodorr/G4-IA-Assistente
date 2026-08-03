import { db } from "@/lib/db";
import { getSettings, isRecallRegion, saveElevenLabsKey, saveOpenAIKey, saveRecallSettings, setAiControls, setSystemVersion } from "@/lib/services/settings";
import { validateOpenAIKey } from "@/lib/services/setup";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const s = await getSettings(db);
  return Response.json(s);
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const { openaiKey, elevenlabsKey, recallApiKey, recallWebhookSecret, recallRegion, recallBotName, defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels, systemVersion } = await req.json();
  let validatedKey: string | null = null;
  if (openaiKey) {
    const key = openaiKey.trim();
    if (!(await validateOpenAIKey(key))) return Response.json({ error: "Chave OpenAI inválida" }, { status: 400 });
    validatedKey = key;
  }
  let validatedElevenLabsKey: string | null = null;
  if (elevenlabsKey) {
    const key = String(elevenlabsKey).trim();
    const validation = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", { method: "POST", headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15_000) });
    if (!validation.ok) return Response.json({ error: "Chave ElevenLabs inválida ou sem acesso ao Scribe Realtime" }, { status: 400 });
    validatedElevenLabsKey = key;
  }
  if (!isRecallRegion(recallRegion)) return Response.json({ error: "Região Recall.ai inválida" }, { status: 400 });
  if (typeof recallBotName !== "string" || !recallBotName.trim()) return Response.json({ error: "Nome do bot inválido" }, { status: 400 });
  if (recallWebhookSecret && !String(recallWebhookSecret).startsWith("whsec_")) return Response.json({ error: "O segredo Recall.ai deve começar com whsec_" }, { status: 400 });
  if (recallApiKey) {
    const validation = await fetch(`https://${recallRegion}.recall.ai/api/v1/bot/?limit=1`, { headers: { Authorization: `Token ${String(recallApiKey).trim()}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!validation.ok) return Response.json({ error: "API Key ou região Recall.ai inválida" }, { status: 400 });
  }
  await db.transaction(async (tx) => {
    if (validatedKey) await saveOpenAIKey(tx, validatedKey);
    if (validatedElevenLabsKey) await saveElevenLabsKey(tx, validatedElevenLabsKey);
    await saveRecallSettings(tx, { apiKey: recallApiKey, webhookSecret: recallWebhookSecret, region: recallRegion, botName: recallBotName });
    if (defaultModel) await setAiControls(tx, { defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels });
    if (typeof systemVersion === "string") await setSystemVersion(tx, systemVersion);
  });
  return new Response(null, { status: 204 });
});
