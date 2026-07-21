import { db } from "@/lib/db";
import { getConversation, deleteConversation } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const got = await getConversation(db, id, session.user.id);
  if (!got) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  return Response.json(got);
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  await deleteConversation(db, id, session.user.id);
  return new Response(null, { status: 204 });
});
