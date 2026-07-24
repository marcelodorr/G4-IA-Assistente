import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { integrationConfigs } from "@/lib/db/schema";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import { disconnectIntegration, getIntegrationConfig } from "@/lib/services/integrations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { provider } = await params;
  if (!isIntegrationProvider(provider)) return Response.json({ error: "Integração inválida" }, { status: 404 });
  const config = await getIntegrationConfig(db, provider);
  if (config.connectionMode === "universal" && session.user.role !== "admin") return Response.json({ error: "Esta conexão é gerenciada pelo administrador" }, { status: 403 });
  await disconnectIntegration(db, config.connectionMode === "universal" ? config.universalConnectionUserId ?? session.user.id : session.user.id, provider);
  if (config.connectionMode === "universal") await db.update(integrationConfigs).set({ universalConnectionUserId: null }).where(eq(integrationConfigs.provider, provider));
  return new Response(null, { status: 204 });
});
