import { db } from "@/lib/db";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import { disconnectIntegration } from "@/lib/services/integrations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { provider } = await params;
  if (!isIntegrationProvider(provider)) return Response.json({ error: "Integração inválida" }, { status: 404 });
  await disconnectIntegration(db, session.user.id, provider);
  return new Response(null, { status: 204 });
});
