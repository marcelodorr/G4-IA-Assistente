import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { endMeeting, getMeetingState, startMeeting } from "@/lib/services/meetings";
import { createRecallBot, removeRecallBot } from "@/lib/meetings/recall";
import { getPublicOrigin } from "@/lib/integrations/oauth";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  return Response.json(await getMeetingState(db, session.user.id, id), { headers: { "Cache-Control": "private, no-store" } });
});

export const PATCH = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const body = await req.json() as { action?: string; assistantId?: string | null };
  if (body.action === "start") return Response.json(await startMeeting(db, session.user.id, id, body.assistantId ?? null));
  if (body.action === "end") { await endMeeting(db, session.user.id, id); return new Response(null, { status: 204 }); }
  if (body.action === "invite_bot") {
    if (body.assistantId) await startMeeting(db, session.user.id, id, body.assistantId);
    return Response.json(await createRecallBot(db, session.user.id, id, getPublicOrigin(req)));
  }
  if (body.action === "leave_bot") { await removeRecallBot(db, session.user.id, id); return new Response(null, { status: 204 }); }
  return Response.json({ error: "Ação inválida" }, { status: 400 });
});
