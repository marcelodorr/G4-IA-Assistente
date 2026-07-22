import { db } from "@/lib/db";
import { backfillCorporateKnowledge } from "@/lib/services/auto-learning";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const POST = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await backfillCorporateKnowledge(db), { status: 202 });
});
