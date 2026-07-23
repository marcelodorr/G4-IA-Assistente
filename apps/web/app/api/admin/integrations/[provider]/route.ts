import { db } from "@/lib/db";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import { updateIntegrationConfig } from "@/lib/services/integrations";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const PATCH = apiHandler(async (req, { params }) => {
  const session = await requireAdmin();
  const { provider } = await params;
  if (!isIntegrationProvider(provider)) return Response.json({ error: "Integração inválida" }, { status: 404 });
  const body = await req.json() as Record<string, unknown>;
  if (typeof body.active !== "boolean" || !Array.isArray(body.userIds) || body.userIds.some((id) => typeof id !== "string")) throw new Error("Configuração inválida");
  await updateIntegrationConfig(db, provider, {
    active: body.active,
    clientId: typeof body.clientId === "string" ? body.clientId : undefined,
    clientSecret: typeof body.clientSecret === "string" ? body.clientSecret : undefined,
    clearSecret: body.clearSecret === true,
    userIds: body.userIds as string[],
    updatedBy: session.user.id,
  });
  return Response.json({ ok: true });
});
