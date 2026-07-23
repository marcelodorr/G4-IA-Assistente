import { db } from "@/lib/db";
import { getConversation, deleteConversation } from "@/lib/services/conversations";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getProject } from "@/lib/services/projects";
import { conversations, corporateMemories, globalContextFiles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

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

export const PATCH = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  if (!(await getConversation(db, id, session.user.id))) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { projectId?: unknown };
  if (body.projectId !== null && typeof body.projectId !== "string") return Response.json({ error: "Projeto inválido" }, { status: 400 });
  if (typeof body.projectId === "string" && !(await getProject(db, body.projectId, session.user.id))) {
    return Response.json({ error: "Projeto não encontrado ou sem permissão" }, { status: 403 });
  }
  await db.update(conversations).set({ projectId: body.projectId ?? null, updatedAt: new Date() }).where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));
  if (body.projectId) {
    await Promise.all([
      db.delete(corporateMemories).where(eq(corporateMemories.conversationId, id)),
      db.delete(globalContextFiles).where(eq(globalContextFiles.sourceConversationId, id)),
    ]);
  }
  return new Response(null, { status: 204 });
});
