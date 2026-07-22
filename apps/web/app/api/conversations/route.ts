import { db } from "@/lib/db";
import { createConversation, listConversations } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { isModelEnabled } from "@/lib/ai/models";
import { getSettings } from "@/lib/services/settings";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listConversations(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { assistantId, model } = await req.json().catch(() => ({}));
  const settings = await getSettings(db);
  if (model && !isModelEnabled(model, settings.disabledModels)) return Response.json({ error: "Modelo inválido ou desabilitado" }, { status: 400 });
  if (assistantId) {
    const [assistant] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!assistant || !assistant.active) return Response.json({ error: "Assistente não encontrado ou inativo" }, { status: 404 });
  }
  const conv = await createConversation(db, { userId: session.user.id, assistantId, model });
  return Response.json(conv, { status: 201 });
});
