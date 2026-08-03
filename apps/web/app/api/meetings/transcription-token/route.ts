import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { requireMeetingsAccess } from "@/lib/services/meetings";
import { getElevenLabsKey } from "@/lib/services/settings";

export const POST = apiHandler(async () => {
  const session = await requireSession();
  await requireMeetingsAccess(db, session.user.id);
  const apiKey = await getElevenLabsKey(db);
  const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
    method: "POST", headers: { "xi-api-key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as { token?: string; detail?: string };
  if (!response.ok || !body.token) throw new Error(body.detail ?? "Não foi possível iniciar a transcrição no ElevenLabs");
  return Response.json({ token: body.token }, { headers: { "Cache-Control": "private, no-store" } });
});
