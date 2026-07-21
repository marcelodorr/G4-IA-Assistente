import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { createInvite } from "@/lib/services/invites";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { desc } from "drizzle-orm";

export const POST = apiHandler(async (req) => {
  await requireAdmin();
  const { email, role = "member" } = await req.json();
  if (!email?.includes("@")) return Response.json({ error: "E-mail inválido" }, { status: 400 });
  const { token } = await createInvite(db, { email, role });
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  const base = proto && host ? `${proto}://${host}` : new URL(req.url).origin;
  return Response.json({ url: `${base}/invite/${token}` });
});

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await db.select().from(invites).orderBy(desc(invites.createdAt)));
});
