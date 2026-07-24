import { db } from "@/lib/db";
import { getSettings, saveOpenAIKey, setAiControls, setSystemVersion } from "@/lib/services/settings";
import { validateOpenAIKey } from "@/lib/services/setup";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const s = await getSettings(db);
  return Response.json(s);
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const { openaiKey, defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels, systemVersion } = await req.json();
  let validatedKey: string | null = null;
  if (openaiKey) {
    const key = openaiKey.trim();
    if (!(await validateOpenAIKey(key))) return Response.json({ error: "Chave OpenAI inválida" }, { status: 400 });
    validatedKey = key;
  }
  await db.transaction(async (tx) => {
    if (validatedKey) await saveOpenAIKey(tx, validatedKey);
    if (defaultModel) await setAiControls(tx, { defaultModel, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels });
    if (typeof systemVersion === "string") await setSystemVersion(tx, systemVersion);
  });
  return new Response(null, { status: 204 });
});
