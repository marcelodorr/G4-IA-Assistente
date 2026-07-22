import { db } from "@/lib/db";
import { revokeUserSessions, setUserActive, setUserPermissions, setUserQuotas, setUserRole } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  if (typeof body.active === "boolean") await setUserActive(db, id, body.active);
  if (body.role === "admin" || body.role === "member") await setUserRole(db, id, body.role);
  if (body.revokeSessions === true) await revokeUserSessions(db, id);
  if ("dailyTokenLimit" in body || "weeklyTokenLimit" in body || "monthlyTokenLimit" in body) {
    await setUserQuotas(db, id, {
      dailyTokenLimit: body.dailyTokenLimit === null ? null : Number(body.dailyTokenLimit),
      weeklyTokenLimit: body.weeklyTokenLimit === null ? null : Number(body.weeklyTokenLimit),
      monthlyTokenLimit: body.monthlyTokenLimit === null ? null : Number(body.monthlyTokenLimit),
    });
  }
  if ("allowedModels" in body || "assistantAccessMode" in body || "assistantIds" in body) {
    if (body.allowedModels !== null && !Array.isArray(body.allowedModels)) throw new Error("Lista de modelos inválida");
    if (body.assistantAccessMode !== "all" && body.assistantAccessMode !== "selected") throw new Error("Modo de acesso inválido");
    if (!Array.isArray(body.assistantIds)) throw new Error("Lista de assistentes inválida");
    await setUserPermissions(db, id, {
      allowedModels: body.allowedModels,
      assistantAccessMode: body.assistantAccessMode,
      assistantIds: body.assistantIds,
    });
  }
  return new Response(null, { status: 204 });
});
