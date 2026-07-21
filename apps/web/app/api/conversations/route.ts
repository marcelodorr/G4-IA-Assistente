import { db } from "@/lib/db";
import { createConversation, listConversations } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { isAllowedModel } from "@/lib/ai/models";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listConversations(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { assistantId, model } = await req.json().catch(() => ({}));
  if (model && !isAllowedModel(model)) return Response.json({ error: "Modelo inválido" }, { status: 400 });
  const conv = await createConversation(db, { userId: session.user.id, assistantId, model });
  return Response.json(conv, { status: 201 });
});
