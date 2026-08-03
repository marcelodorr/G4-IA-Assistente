import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { generateMeetingInsight, getMeetingState } from "@/lib/services/meetings";
import { getRecallConfig } from "@/lib/services/settings";

type RecallTranscriptEvent = {
  event?: string;
  data?: {
    bot_id?: string;
    status?: { code?: string; sub_code?: string | null };
    data?: { words?: Array<{ text?: string }>; participant?: { name?: string | null; email?: string | null } | null };
    bot?: { id?: string };
  };
};

export function verifyRecallRequest(secret: string, headers: Headers, payload: string) {
  const messageId = headers.get("webhook-id") ?? headers.get("svix-id");
  const timestamp = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const signatures = headers.get("webhook-signature") ?? headers.get("svix-signature");
  if (!secret.startsWith("whsec_") || !messageId || !timestamp || !signatures) throw new Error("Assinatura Recall.ai ausente");
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1_000 - timestampSeconds) > 300) throw new Error("Webhook Recall.ai expirado");
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${messageId}.${timestamp}.${payload}`).digest("base64"), "base64");
  const valid = signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const received = Buffer.from(signature, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!valid) throw new Error("Assinatura Recall.ai inválida");
}

export async function createRecallBot(db: Db, userId: string, meetingId: string, publicOrigin: string) {
  const state = await getMeetingState(db, userId, meetingId);
  if (!state.meeting.joinUrl) throw new Error("Informe o link da reunião antes de enviar o bot");
  if (!state.meeting.assistantId) throw new Error("Escolha um assistente antes de enviar o bot");
  if (state.meeting.recallBotId && !["done", "fatal", "left"].includes(state.meeting.recallBotStatus ?? "")) throw new Error("Já existe um bot associado a esta reunião");
  const url = new URL(state.meeting.joinUrl);
  if (url.protocol !== "https:") throw new Error("O link da reunião deve usar HTTPS");
  const config = await getRecallConfig(db);
  const webhookUrl = new URL("/api/meetings/recall/webhook", publicOrigin).toString();
  const future = state.meeting.startsAt.getTime() > Date.now() + 10 * 60_000;
  const response = await fetch(`https://${config.region}.recall.ai/api/v1/bot/`, {
    method: "POST",
    headers: { Authorization: `Token ${config.apiKey}`, Accept: "application/json", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      meeting_url: url.toString(), bot_name: config.botName,
      ...(future ? { join_at: state.meeting.startsAt.toISOString() } : {}),
      metadata: { meeting_id: meetingId },
      recording_config: {
        transcript: { provider: { elevenlabs_streaming: { model_id: "scribe_v2_realtime", language_code: "pt" } }, diarization: { use_separate_streams_when_available: true } },
        realtime_endpoints: [{ type: "webhook", url: webhookUrl, events: ["transcript.data"] }],
      },
    }),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; detail?: string; code?: string };
  if (!response.ok || !body.id) throw new Error(body.detail ?? body.code ?? "Não foi possível enviar o bot para a reunião");
  const status = future ? "scheduled" : "joining_call";
  await db.update(meetings).set({ recallBotId: body.id, recallBotStatus: status, status: future ? "scheduled" : "live", updatedAt: new Date() }).where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
  return { botId: body.id, status };
}

export async function removeRecallBot(db: Db, userId: string, meetingId: string) {
  const state = await getMeetingState(db, userId, meetingId);
  if (!state.meeting.recallBotId) return;
  const config = await getRecallConfig(db);
  const response = await fetch(`https://${config.region}.recall.ai/api/v1/bot/${encodeURIComponent(state.meeting.recallBotId)}/leave_call/`, {
    method: "POST", headers: { Authorization: `Token ${config.apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok && response.status !== 400) throw new Error("Não foi possível remover o bot da reunião");
  await db.update(meetings).set({ recallBotStatus: "left", status: "ended", updatedAt: new Date() }).where(eq(meetings.id, meetingId));
}

export async function processRecallWebhook(db: Db, payload: RecallTranscriptEvent) {
  if (payload.event?.startsWith("bot.") && payload.data?.bot_id) {
    const code = payload.data.status?.code ?? payload.event.slice(4);
    const terminal = ["done", "fatal"].includes(code);
    await db.update(meetings).set({ recallBotStatus: code, ...(terminal ? { status: "ended" as const } : {}), updatedAt: new Date() }).where(eq(meetings.recallBotId, payload.data.bot_id));
    return;
  }
  if (payload.event !== "transcript.data") return;
  const botId = payload.data?.bot?.id;
  const words = payload.data?.data?.words ?? [];
  const text = words.map((word) => word.text ?? "").join(" ").replace(/\s+/g, " ").trim();
  if (!botId || !text) return;
  const [meeting] = await db.select({ id: meetings.id, userId: meetings.userId }).from(meetings).where(eq(meetings.recallBotId, botId)).limit(1);
  if (!meeting) return;
  await db.update(meetings).set({ recallBotStatus: "in_call_recording", status: "live", updatedAt: new Date() }).where(eq(meetings.id, meeting.id));
  const participant = payload.data?.data?.participant;
  const { appendTranscript } = await import("@/lib/services/meetings");
  await appendTranscript(db, meeting.id, { speaker: participant?.name?.trim() || participant?.email?.trim() || "Participante", text, source: "elevenlabs", isFinal: true });
  await generateMeetingInsight(db, meeting.userId, meeting.id).catch((error) => console.error("[recall] insight falhou", error));
}
