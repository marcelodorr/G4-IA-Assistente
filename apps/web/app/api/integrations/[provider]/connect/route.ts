import { db } from "@/lib/db";
import { connectApify, connectGitBook, syncIntegrationSnapshot } from "@/lib/integrations/client";
import { INTEGRATIONS, isIntegrationProvider } from "@/lib/integrations/catalog";
import { buildAuthorizationUrl, getOauthCallbackUri } from "@/lib/integrations/oauth";
import { canUserUseIntegration, createOauthState, getIntegrationConfig, markUniversalConnectionOwner } from "@/lib/services/integrations";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const POST = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { provider } = await params;
  if (!isIntegrationProvider(provider)) return Response.json({ error: "Integração inválida" }, { status: 404 });
  if (!(await canUserUseIntegration(db, session.user.id, provider))) return Response.json({ error: "Integração não liberada para seu usuário" }, { status: 403 });
  const config = await getIntegrationConfig(db, provider);
  if (config.connectionMode === "universal" && session.user.role !== "admin") return Response.json({ error: "Esta conexão é gerenciada pelo administrador da empresa" }, { status: 403 });
  if (provider === "apify" || provider === "gitbook") {
    const body = await req.json() as { token?: unknown };
    if (typeof body.token !== "string") throw new Error(`Informe seu token ${INTEGRATIONS[provider].name}`);
    if (provider === "apify") await connectApify(db, session.user.id, body.token);
    else await connectGitBook(db, session.user.id, body.token);
    if (config.connectionMode === "universal") await markUniversalConnectionOwner(db, provider, session.user.id);
    void syncIntegrationSnapshot(db, session.user.id, provider).catch((error) => console.error(`[integração] sincronização inicial ${provider} falhou`, error));
    return Response.json({ connected: true });
  }
  const redirectUri = getOauthCallbackUri(req, provider);
  const state = await createOauthState(db, session.user.id, provider, redirectUri, config.connectionMode);
  return Response.json({ authorizationUrl: await buildAuthorizationUrl(db, provider, state, redirectUri) });
});
