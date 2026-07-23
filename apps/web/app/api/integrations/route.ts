import { db } from "@/lib/db";
import { listUserIntegrations } from "@/lib/services/integrations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listUserIntegrations(db, session.user.id), { headers: { "Cache-Control": "private, no-store" } });
});
