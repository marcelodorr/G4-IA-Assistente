import { db } from "@/lib/db";
import { createInvite, listInvites } from "@/lib/services/invites";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export function publicBaseUrl(req: Request) {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return proto && host ? `${proto}://${host}` : new URL(req.url).origin;
}

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const { email, role = "member" } = await req.json();
  if (!email?.includes("@")) return Response.json({ error: "E-mail inválido" }, { status: 400 });
  const { token } = await createInvite(db, { email, role, createdBy: session.user.id });
  const base = publicBaseUrl(req);
  return Response.json({ url: `${base}/invite/${token}` });
});

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await listInvites(db));
});
