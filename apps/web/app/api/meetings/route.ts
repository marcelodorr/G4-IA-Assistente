import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { createAdHocMeeting, listMeetingAssistants, listMeetings, syncTeamsMeetings } from "@/lib/services/meetings";

export const GET = apiHandler(async (req) => {
  const session = await requireSession();
  const params = new URL(req.url).searchParams;
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  const [meetingRows, assistants] = await Promise.all([
    params.get("sync") === "1" ? syncTeamsMeetings(db, session.user.id, from, to).catch((error) => {
      console.info("[reuniões] agenda Teams indisponível; mantendo reuniões locais", error instanceof Error ? error.message : error);
      return listMeetings(db, session.user.id, from, to);
    }) : listMeetings(db, session.user.id, from, to),
    listMeetingAssistants(db, session.user.id),
  ]);
  return Response.json({ meetings: meetingRows, assistants }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json() as { title?: string; assistantId?: string | null; joinUrl?: string | null };
  if (typeof body.title !== "string") return Response.json({ error: "Nome da reunião inválido" }, { status: 400 });
  return Response.json(await createAdHocMeeting(db, session.user.id, { title: body.title, assistantId: body.assistantId, joinUrl: body.joinUrl }), { status: 201 });
});
