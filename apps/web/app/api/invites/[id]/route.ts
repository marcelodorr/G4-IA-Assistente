import { db } from "@/lib/db";
import { renewInvite, revokeInvite } from "@/lib/services/invites";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { publicBaseUrl } from "@/app/api/invites/route";

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await revokeInvite(db, id);
  return new Response(null, { status: 204 });
});

export const POST = apiHandler(async (req, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const { token } = await renewInvite(db, id, session.user.id);
  return Response.json({ url: `${publicBaseUrl(req)}/invite/${token}` });
});
