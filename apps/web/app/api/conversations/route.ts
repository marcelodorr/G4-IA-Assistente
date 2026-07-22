import { db } from "@/lib/db";
import { createConversation, listConversations } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { isModelEnabled } from "@/lib/ai/models";
import { getSettings } from "@/lib/services/settings";
import { canUserAccessAssistant } from "@/lib/services/assistants";
import { filterUserModels, getUserAccess } from "@/lib/services/users";
import { SUPPORTED_MODELS } from "@/lib/ai/models";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listConversations(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { assistantId, model } = await req.json().catch(() => ({}));
  const settings = await getSettings(db);
  const access = await getUserAccess(db, session.user.id);
  const globallyEnabled = SUPPORTED_MODELS.filter((item) => isModelEnabled(item, settings.disabledModels));
  const userModels = filterUserModels(globallyEnabled, access.allowedModels);
  if (typeof model !== "string" || !userModels.includes(model)) return Response.json({ error: "Modelo não permitido para este usuário" }, { status: 403 });
  if (assistantId) {
    if (typeof assistantId !== "string" || !(await canUserAccessAssistant(db, session.user.id, assistantId))) {
      return Response.json({ error: "Assistente não disponível para este usuário" }, { status: 403 });
    }
  }
  const conv = await createConversation(db, { userId: session.user.id, assistantId, model });
  return Response.json(conv, { status: 201 });
});
