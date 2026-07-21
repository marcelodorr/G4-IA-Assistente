import { db } from "@/lib/db";
import { listUsers } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const GET = apiHandler(async () => {
  await requireAdmin();
  return Response.json(await listUsers(db));
});
