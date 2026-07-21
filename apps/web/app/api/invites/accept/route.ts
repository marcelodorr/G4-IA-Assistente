import { db } from "@/lib/db";
import { acceptInvite } from "@/lib/services/invites";
import { apiHandler } from "@/lib/services/guards";

export const POST = apiHandler(async (req) => {
  const { token, name, password } = await req.json();
  await acceptInvite(db, token, { name, password });
  return new Response(null, { status: 204 });
});
