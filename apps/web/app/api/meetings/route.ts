import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { listMeetingAssistants, listMeetings, syncTeamsMeetings } from "@/lib/services/meetings";

export const GET = apiHandler(async (req) => {
  const session = await requireSession();
  const params = new URL(req.url).searchParams;
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  const [meetings, assistants] = await Promise.all([
    params.get("sync") === "1" ? syncTeamsMeetings(db, session.user.id, from, to) : listMeetings(db, session.user.id, from, to),
    listMeetingAssistants(db, session.user.id),
  ]);
  return Response.json({ meetings, assistants }, { headers: { "Cache-Control": "private, no-store" } });
});
