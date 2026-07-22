import { db } from "@/lib/db";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { getGlobalContext, setGlobalContext } from "@/lib/services/global-context";

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json({ content: await getGlobalContext(db) });
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  if (typeof body.content !== "string") throw new Error("Contexto geral inválido");
  await setGlobalContext(db, body.content);
  return new Response(null, { status: 204 });
});
