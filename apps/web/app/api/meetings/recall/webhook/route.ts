import { after } from "next/server";
import { db } from "@/lib/db";
import { processRecallWebhook, verifyRecallRequest } from "@/lib/meetings/recall";
import { getRecallConfig } from "@/lib/services/settings";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const config = await getRecallConfig(db);
    verifyRecallRequest(config.webhookSecret, req.headers, rawBody);
    const payload = JSON.parse(rawBody) as Parameters<typeof processRecallWebhook>[1];
    after(() => processRecallWebhook(db, payload).catch((error) => console.error("[recall] processamento de webhook falhou", error)));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[recall] webhook rejeitado", error instanceof Error ? error.message : error);
    return Response.json({ error: "Webhook inválido" }, { status: 401 });
  }
}
