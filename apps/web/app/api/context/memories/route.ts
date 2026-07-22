import { db } from "@/lib/db";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { listCorporateMemories } from "@/lib/services/corporate-memory";

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await listCorporateMemories(db));
});
