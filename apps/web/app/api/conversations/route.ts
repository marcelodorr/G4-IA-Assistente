import { db } from "@/lib/db";
import { createConversation, listConversations } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listConversations(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { assistantId, model } = await req.json().catch(() => ({}));
  const conv = await createConversation(db, { userId: session.user.id, assistantId, model });
  return Response.json(conv, { status: 201 });
});
