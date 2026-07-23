import { db } from "@/lib/db";
import { isIntegrationProvider } from "@/lib/integrations/catalog";
import { exchangeAuthorizationCode, getPublicOrigin } from "@/lib/integrations/oauth";
import { consumeOauthState } from "@/lib/services/integrations";
import { requireSession } from "@/lib/services/guards";
import { syncIntegrationSnapshot } from "@/lib/integrations/client";

function destination(req: Request, values: Record<string, string>) {
  const url = new URL("/integracoes", getPublicOrigin(req));
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
  return url;
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  try {
    const session = await requireSession();
    if (!isIntegrationProvider(provider) || provider === "apify") throw new Error("Integração inválida");
    const url = new URL(req.url);
    const error = url.searchParams.get("error");
    if (error) throw new Error(url.searchParams.get("error_description") ?? "Autorização cancelada pelo usuário");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("Resposta OAuth incompleta");
    const oauthState = await consumeOauthState(db, state);
    if (oauthState.userId !== session.user.id || oauthState.provider !== provider) throw new Error("Autorização não pertence a este usuário");
    await exchangeAuthorizationCode(db, session.user.id, provider, code, oauthState.redirectUri);
    void syncIntegrationSnapshot(db, session.user.id, provider).catch((syncError) => console.error(`[integração] sincronização inicial ${provider} falhou`, syncError));
    return Response.redirect(destination(req, { connected: provider }), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível conectar a integração";
    return Response.redirect(destination(req, { integrationError: message.slice(0, 300) }), 303);
  }
}
