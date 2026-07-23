import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { integrationActivity, integrationConnections } from "@/lib/db/schema";
import { INTEGRATIONS, type IntegrationProvider } from "./catalog";
import { getValidAccessToken } from "./oauth";
import { canUserUseIntegration, saveUserConnection } from "@/lib/services/integrations";
import { captureCorporateMemory } from "@/lib/services/corporate-memory";

type QueryInput = Record<string, unknown>;

async function fetchJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000), headers: { Accept: "application/json", ...init.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? String(data.message) : `HTTP ${response.status}`;
    throw new Error(`A plataforma recusou a consulta: ${message}`);
  }
  return data;
}

function clampLimit(value: unknown, fallback = 20) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 50) : fallback;
}

async function googleCalendar(token: string, input: QueryInput) {
  const params = new URLSearchParams({
    timeMin: typeof input.from === "string" ? new Date(input.from).toISOString() : new Date().toISOString(),
    timeMax: typeof input.to === "string" ? new Date(input.to).toISOString() : new Date(Date.now() + 30 * 86400_000).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: String(clampLimit(input.limit)),
  });
  if (typeof input.query === "string" && input.query.trim()) params.set("q", input.query.trim());
  return fetchJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
}

const HUBSPOT_PROPERTIES: Record<string, string[]> = {
  contacts: ["firstname", "lastname", "email", "phone", "company", "lifecyclestage", "lastmodifieddate"],
  companies: ["name", "domain", "industry", "city", "phone", "hs_lastmodifieddate"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hs_lastmodifieddate"],
};

async function hubspot(token: string, input: QueryInput) {
  const resource = ["contacts", "companies", "deals"].includes(String(input.resource)) ? String(input.resource) : "deals";
  const limit = clampLimit(input.limit);
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (query) return fetchJson(`https://api.hubapi.com/crm/v3/objects/${resource}/search`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, properties: HUBSPOT_PROPERTIES[resource] }),
  });
  const params = new URLSearchParams({ limit: String(limit), properties: HUBSPOT_PROPERTIES[resource].join(",") });
  return fetchJson(`https://api.hubapi.com/crm/v3/objects/${resource}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function pipedrive(token: string, apiDomain: string, input: QueryInput) {
  const resource = ["deals", "persons", "organizations"].includes(String(input.resource)) ? String(input.resource) : "deals";
  const limit = clampLimit(input.limit);
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (query) {
    const type = resource === "deals" ? "deal" : resource === "persons" ? "person" : "organization";
    const params = new URLSearchParams({ term: query, item_types: type, limit: String(limit) });
    return fetchJson(`${apiDomain}/api/v1/itemSearch?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  return fetchJson(`${apiDomain}/api/v1/${resource}?limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function apify(token: string, input: QueryInput) {
  const action = String(input.action ?? "list_datasets");
  const limit = clampLimit(input.limit);
  const headers = { Authorization: `Bearer ${token}` };
  if (action === "dataset_items") {
    if (typeof input.datasetId !== "string" || !/^[\w~-]+$/.test(input.datasetId)) throw new Error("Informe um datasetId válido");
    return fetchJson(`https://api.apify.com/v2/datasets/${encodeURIComponent(input.datasetId)}/items?clean=true&limit=${limit}`, { headers });
  }
  const endpoint = action === "list_runs" ? "actor-runs" : action === "list_actors" ? "acts" : "datasets";
  return fetchJson(`https://api.apify.com/v2/${endpoint}?desc=1&limit=${limit}`, { headers });
}

async function jira(token: string, cloudId: string, input: QueryInput) {
  const action = String(input.action ?? "search_issues");
  const base = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
  const headers = { Authorization: `Bearer ${token}` };
  const limit = clampLimit(input.limit);
  if (action === "list_projects") return fetchJson(`${base}/project/search?maxResults=${limit}`, { headers });
  const jql = typeof input.jql === "string" && input.jql.trim() ? input.jql.trim() : "order by updated DESC";
  const params = new URLSearchParams({ jql, maxResults: String(limit), fields: "summary,status,assignee,priority,updated,project,issuetype" });
  return fetchJson(`${base}/search/jql?${params}`, { headers });
}

function compactResult(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  return text.length > 30_000 ? `${text.slice(0, 30_000)}\n[resultado truncado]` : text;
}

export async function executeIntegrationQuery(db: Db, input: {
  userId: string;
  conversationId?: string;
  provider: IntegrationProvider;
  action: string;
  params: QueryInput;
}) {
  if (!(await canUserUseIntegration(db, input.userId, input.provider))) throw new Error("Esta integração não está liberada para o usuário");
  const startedAt = Date.now();
  try {
    const { token, connection } = await getValidAccessToken(db, input.userId, input.provider);
    let result: unknown;
    if (input.provider === "google_calendar") result = await googleCalendar(token, input.params);
    else if (input.provider === "hubspot") result = await hubspot(token, input.params);
    else if (input.provider === "pipedrive") result = await pipedrive(token, String((connection.metadata as Record<string, unknown>).apiDomain ?? "https://api.pipedrive.com"), input.params);
    else if (input.provider === "apify") result = await apify(token, input.params);
    else result = await jira(token, String((connection.metadata as Record<string, unknown>).cloudId ?? connection.externalAccountId ?? ""), input.params);
    const content = compactResult(result);
    await Promise.all([
      db.insert(integrationActivity).values({ userId: input.userId, conversationId: input.conversationId ?? null, provider: input.provider, action: input.action, requestSummary: input.params, resultContent: content, success: true }),
      db.update(integrationConnections).set({ lastUsedAt: new Date(), lastError: null, updatedAt: new Date() }).where(and(eq(integrationConnections.userId, input.userId), eq(integrationConnections.provider, input.provider))),
    ]);
    void captureCorporateMemory(db, {
      userId: input.userId, conversationId: input.conversationId, sourceType: "integration", sourceProvider: input.provider,
      content: `Dados consultados em ${INTEGRATIONS[input.provider].name}. Ação: ${input.action}. Parâmetros: ${JSON.stringify(input.params)}\n${content}`,
    }).catch((error) => console.error("[integração] falha ao alimentar contexto corporativo", error));
    return { provider: INTEGRATIONS[input.provider].name, durationMs: Date.now() - startedAt, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([
      db.insert(integrationActivity).values({ userId: input.userId, conversationId: input.conversationId ?? null, provider: input.provider, action: input.action, requestSummary: input.params, success: false, error: message }),
      db.update(integrationConnections).set({ lastError: message, updatedAt: new Date() }).where(and(eq(integrationConnections.userId, input.userId), eq(integrationConnections.provider, input.provider))),
    ]);
    throw error;
  }
}

export async function connectApify(db: Db, userId: string, token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 20) throw new Error("Token Apify inválido");
  const profile = await fetchJson("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${trimmed}` } }) as { data?: { id?: string; username?: string; email?: string; profile?: { name?: string } } };
  const account = profile.data;
  await saveUserConnection(db, { userId, provider: "apify", accessToken: trimmed, externalAccountId: account?.id, accountLabel: account?.email ?? account?.profile?.name ?? account?.username ?? "Apify conectado" });
  void syncIntegrationSnapshot(db, userId, "apify").catch((error) => console.error("[integração] sincronização inicial Apify falhou", error));
}

export function syncIntegrationSnapshot(db: Db, userId: string, provider: IntegrationProvider) {
  const defaults: Record<IntegrationProvider, { action: string; params: QueryInput }> = {
    google_calendar: { action: "initial_events", params: { limit: 30 } },
    hubspot: { action: "initial_deals", params: { resource: "deals", limit: 30 } },
    pipedrive: { action: "initial_deals", params: { resource: "deals", limit: 30 } },
    apify: { action: "initial_datasets", params: { action: "list_datasets", limit: 30 } },
    jira: { action: "initial_issues", params: { action: "search_issues", jql: "order by updated DESC", limit: 30 } },
  };
  return executeIntegrationQuery(db, { userId, provider, ...defaults[provider] });
}
