import { decrypt } from "@/lib/crypto";
import type { Db } from "@/lib/db";
import { INTEGRATIONS, type IntegrationProvider } from "./catalog";
import { getIntegrationConfig, getUserConnection, saveUserConnection } from "@/lib/services/integrations";

type OAuthProvider = Exclude<IntegrationProvider, "apify" | "gitbook">;
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  api_domain?: string;
};

export function getPublicOrigin(req: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${protocol}://${host}` : new URL(req.url).origin;
}

export function getOauthCallbackUri(req: Request, provider: OAuthProvider) {
  return `${getPublicOrigin(req)}/api/integrations/oauth/callback/${provider}`;
}

export async function buildAuthorizationUrl(db: Db, provider: OAuthProvider, state: string, redirectUri: string) {
  const config = await getIntegrationConfig(db, provider);
  if (!config.clientId || !config.clientSecret) throw new Error("Integração ainda não foi configurada pelo administrador");
  const scopes = INTEGRATIONS[provider].scopes?.join(" ") ?? "";
  if (provider === "google_calendar") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", scope: scopes, access_type: "offline", include_granted_scopes: "true", prompt: "consent", state }).toString();
    return url.toString();
  }
  if (provider === "hubspot") {
    const url = new URL("https://app.hubspot.com/oauth/authorize");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, scope: scopes, state }).toString();
    return url.toString();
  }
  if (provider === "pipedrive") {
    const url = new URL("https://oauth.pipedrive.com/oauth/authorize");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state }).toString();
    return url.toString();
  }
  const url = new URL("https://auth.atlassian.com/authorize");
  url.search = new URLSearchParams({ audience: "api.atlassian.com", client_id: config.clientId, redirect_uri: redirectUri, scope: scopes, state, response_type: "code", prompt: "consent" }).toString();
  return url.toString();
}

async function parseTokenResponse(response: Response) {
  const body = await response.json().catch(() => ({})) as Partial<TokenResponse> & { error?: string; error_description?: string; message?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description ?? body.message ?? body.error ?? "Não foi possível obter autorização da plataforma");
  return body as TokenResponse;
}

async function requestOAuthToken(db: Db, provider: OAuthProvider, values: Record<string, string>, refresh = false) {
  const config = await getIntegrationConfig(db, provider);
  if (!config.clientId || !config.clientSecret) throw new Error("Credenciais OAuth não configuradas");
  if (provider === "jira") {
    return parseTokenResponse(await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ...values }),
    }));
  }
  const endpoint = provider === "google_calendar" ? "https://oauth2.googleapis.com/token"
    : provider === "hubspot" ? "https://api.hubapi.com/oauth/v3/token"
      : "https://oauth.pipedrive.com/oauth/token";
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(values);
  if (provider === "pipedrive") headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  else { body.set("client_id", config.clientId); body.set("client_secret", config.clientSecret); }
  if (refresh && provider === "google_calendar") body.delete("redirect_uri");
  return parseTokenResponse(await fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(20_000) }));
}

export async function exchangeAuthorizationCode(db: Db, userId: string, provider: OAuthProvider, code: string, redirectUri: string) {
  const token = await requestOAuthToken(db, provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
  let externalAccountId: string | null = null;
  let accountLabel: string | null = null;
  let metadata: Record<string, unknown> = {};
  if (provider === "google_calendar") {
    const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000) }).then((response) => response.ok ? response.json() : null) as { sub?: string; email?: string; name?: string } | null;
    externalAccountId = profile?.sub ?? null;
    accountLabel = profile?.email ?? profile?.name ?? "Google Calendar conectado";
  } else if (provider === "pipedrive") {
    const apiDomain = token.api_domain ?? "https://api.pipedrive.com";
    const profile = await fetch(`${apiDomain}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000) }).then((response) => response.ok ? response.json() : null) as { data?: { id?: number; name?: string; email?: string; company_name?: string } } | null;
    externalAccountId = profile?.data?.id ? String(profile.data.id) : null;
    accountLabel = profile?.data?.email ?? profile?.data?.name ?? "Pipedrive conectado";
    metadata = { apiDomain, companyName: profile?.data?.company_name ?? null };
  } else if (provider === "jira") {
    const resources = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) }).then(async (response) => response.ok ? response.json() : []) as Array<{ id: string; name: string; url: string }>;
    const resource = resources[0];
    if (!resource) throw new Error("Nenhum site Jira foi autorizado para esta conta");
    externalAccountId = resource.id;
    accountLabel = `${resource.name} (${resource.url})`;
    metadata = { cloudId: resource.id, siteUrl: resource.url, resources };
  } else {
    accountLabel = "HubSpot conectado";
  }
  await saveUserConnection(db, { userId, provider, accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in, scopes: token.scope, externalAccountId, accountLabel, metadata });
}

export async function getValidAccessToken(db: Db, userId: string, provider: IntegrationProvider) {
  const connection = await getUserConnection(db, userId, provider);
  if (!connection || connection.status !== "connected") throw new Error(`${INTEGRATIONS[provider].name} não está conectado para este usuário`);
  if (!connection.expiresAt || connection.expiresAt.getTime() > Date.now() + 60_000) return { token: decrypt(connection.accessTokenEncrypted), connection };
  if (provider === "apify" || provider === "gitbook" || !connection.refreshTokenEncrypted) throw new Error("A autorização expirou. Reconecte a integração.");
  const refreshToken = decrypt(connection.refreshTokenEncrypted);
  const token = await requestOAuthToken(db, provider, { grant_type: "refresh_token", refresh_token: refreshToken }, true);
  await saveUserConnection(db, {
    userId, provider, accessToken: token.access_token, refreshToken: token.refresh_token ?? refreshToken,
    expiresIn: token.expires_in, scopes: token.scope ?? connection.scopes,
    externalAccountId: connection.externalAccountId, accountLabel: connection.accountLabel,
    metadata: connection.metadata as Record<string, unknown>,
  });
  return { token: token.access_token, connection: (await getUserConnection(db, userId, provider))! };
}
