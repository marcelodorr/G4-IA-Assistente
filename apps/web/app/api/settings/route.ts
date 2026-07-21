import { db } from "@/lib/db";
import { getSettings, saveOpenAIKey, setDefaultModel } from "@/lib/services/settings";
import { validateOpenAIKey } from "@/lib/services/setup";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const s = await getSettings(db);
  return Response.json({ defaultModel: s.defaultModel, hasKey: s.hasKey });
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const { openaiKey, defaultModel } = await req.json();
  if (openaiKey) {
    if (!(await validateOpenAIKey(openaiKey))) return Response.json({ error: "Chave OpenAI inválida" }, { status: 400 });
    await saveOpenAIKey(db, openaiKey);
  }
  if (defaultModel) await setDefaultModel(db, defaultModel);
  return new Response(null, { status: 204 });
});
