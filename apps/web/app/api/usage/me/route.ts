import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getUserUsageSummary } from "@/lib/services/usage";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  const usage = await getUserUsageSummary(db, session.user.id);
  return Response.json(usage, { headers: { "Cache-Control": "no-store" } });
});
