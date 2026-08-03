import { db } from "@/lib/db";
import { getSettings, saveElevenLabsKey, saveOpenAIKey, setAiControls, setSystemVersion } from "@/lib/services/settings";
import { validateOpenAIKey } from "@/lib/services/setup";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const s = await getSettings(db);
  return Response.json(s);
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const { openaiKey, elevenlabsKey, defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels, systemVersion } = await req.json();
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
  await db.transaction(async (tx) => {
    if (validatedKey) await saveOpenAIKey(tx, validatedKey);
    if (validatedElevenLabsKey) await saveElevenLabsKey(tx, validatedElevenLabsKey);
    if (defaultModel) await setAiControls(tx, { defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels });
    if (typeof systemVersion === "string") await setSystemVersion(tx, systemVersion);
  });
  return new Response(null, { status: 204 });
});
