import { db } from "@/lib/db";
import { setUserActive, setUserQuotas } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  if (typeof body.active === "boolean") await setUserActive(db, id, body.active);
  if ("dailyTokenLimit" in body || "monthlyTokenLimit" in body) {
    await setUserQuotas(db, id, {
      dailyTokenLimit: body.dailyTokenLimit === null ? null : Number(body.dailyTokenLimit),
      monthlyTokenLimit: body.monthlyTokenLimit === null ? null : Number(body.monthlyTokenLimit),
    });
  }
  return new Response(null, { status: 204 });
});
