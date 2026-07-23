import { db } from "@/lib/db";
import { connectApify } from "@/lib/integrations/client";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import { buildAuthorizationUrl, getOauthCallbackUri } from "@/lib/integrations/oauth";
import { canUserUseIntegration, createOauthState } from "@/lib/services/integrations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const POST = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { provider } = await params;
  if (!isIntegrationProvider(provider)) return Response.json({ error: "Integração inválida" }, { status: 404 });
  if (!(await canUserUseIntegration(db, session.user.id, provider))) return Response.json({ error: "Integração não liberada para seu usuário" }, { status: 403 });
  if (provider === "apify") {
    const body = await req.json() as { token?: unknown };
    if (typeof body.token !== "string") throw new Error("Informe seu token Apify");
    await connectApify(db, session.user.id, body.token);
    return Response.json({ connected: true });
  }
  const redirectUri = getOauthCallbackUri(req, provider);
  const state = await createOauthState(db, session.user.id, provider, redirectUri);
  return Response.json({ authorizationUrl: await buildAuthorizationUrl(db, provider, state, redirectUri) });
});
