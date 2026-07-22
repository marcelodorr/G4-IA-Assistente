import { db } from "@/lib/db";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { getGlobalContext, setAutoLearn, setGlobalContext } from "@/lib/services/global-context";
import { getSettings } from "@/lib/services/settings";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const [content, settings] = await Promise.all([getGlobalContext(db), getSettings(db)]);
  return Response.json({ content, autoLearnEnabled: settings.autoLearnEnabled });
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  if (typeof body.content !== "string") throw new Error("Contexto geral inválido");
  await setGlobalContext(db, body.content);
  if (typeof body.autoLearnEnabled === "boolean") await setAutoLearn(db, body.autoLearnEnabled);
  return new Response(null, { status: 204 });
});
