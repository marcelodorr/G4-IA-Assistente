import { db } from "@/lib/db";
import { isSetupCompleted, completeSetup } from "@/lib/services/setup";
import { apiHandler } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  return Response.json({ setupCompleted: await isSetupCompleted(db) });
});

export const POST = apiHandler(async (req) => {
  if (await isSetupCompleted(db)) return Response.json({ error: "Já configurado" }, { status: 409 });
  await completeSetup(db, await req.json());
  return new Response(null, { status: 204 });
});
