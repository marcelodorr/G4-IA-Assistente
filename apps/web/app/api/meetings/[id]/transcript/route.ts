import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { appendTranscript, generateMeetingInsight, getMeetingState } from "@/lib/services/meetings";

export const POST = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const authorization = req.headers.get("authorization");
  const configuredSecret = process.env.TRANSCRIPTION_WEBHOOK_SECRET;
  let ownerId: string;
  if (configuredSecret && authorization === `Bearer ${configuredSecret}`) {
    const [meeting] = await db.select({ userId: meetings.userId }).from(meetings).where(eq(meetings.id, id)).limit(1);
    if (!meeting) return Response.json({ error: "Reunião não encontrada" }, { status: 404 });
    ownerId = meeting.userId;
  } else {
    const session = await requireSession();
    await getMeetingState(db, session.user.id, id);
    ownerId = session.user.id;
  }
  const body = await req.json() as { speaker?: string; text?: string; isFinal?: boolean; source?: "manual" | "elevenlabs" | "teams" };
  if (typeof body.text !== "string") return Response.json({ error: "Texto inválido" }, { status: 400 });
  const segment = await appendTranscript(db, id, { ...body, text: body.text });
  if (segment.isFinal) void generateMeetingInsight(db, ownerId, id).catch((error) => console.error("[reuniões] insight em tempo real falhou", error));
  return Response.json(segment, { status: 201 });
});
