import { db } from "@/lib/db";
import { setUserActive } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { active } = await req.json();
  await setUserActive(db, id, Boolean(active));
  return new Response(null, { status: 204 });
});
